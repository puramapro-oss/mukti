#!/usr/bin/env python3
"""Local, offline retuning of one mono/stereo audio track with FFmpeg.

This tool does not intercept other apps, open streaming URLs, infer the original
tuning, or access a music service. A 440 -> 432 conversion is meaningful only
when the original reference really is A4=440 Hz. The original file is untouched.

Runtime: Python 3.10+, ffmpeg built with librubberband, and ffprobe.
Formats: WAV (24-bit PCM), FLAC (24-bit), MKV (copied first video + FLAC),
MP4 (copied first video + AAC). Other streams, artwork, and chapters are omitted.
"""

from __future__ import annotations

import argparse
from fractions import Fraction
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from typing import Any


MIN_RATIO = 0.5
MAX_RATIO = 2.0
LIMITER_CEILING = 10 ** (-1 / 20)  # -1 dBFS sample peak before encoding.
OUTPUT_SUFFIXES = {".wav", ".flac", ".mkv", ".mp4"}


class RetuneError(Exception):
    """An expected conversion/validation failure, safe to show in the CLI."""


def _local_path(value: str | Path) -> Path:
    raw = os.fspath(value)
    if not isinstance(raw, str) or not raw or raw == "-" or "\x00" in raw:
        raise RetuneError("Un chemin vers un fichier local est requis.")
    windows_drive = os.name == "nt" and re.match(r"^[A-Za-z]:[\\/]", raw)
    if not windows_drive and re.match(r"^[A-Za-z][A-Za-z0-9+.-]*:", raw):
        raise RetuneError("Les URL et protocoles sont refusés : fichiers locaux uniquement.")
    if raw.startswith("//") or raw.startswith("\\\\"):
        raise RetuneError("Les chemins réseau sont refusés : fichiers locaux uniquement.")
    return Path(raw).expanduser()


def tuning_ratio(source_hz: float, target_hz: float) -> float:
    """Validate reference pitches, then return a proportional frequency ratio."""
    for value, name in ((source_hz, "source"), (target_hz, "cible")):
        if not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
            raise RetuneError(f"La référence {name} doit être un nombre fini strictement positif.")
    ratio = target_hz / source_hz
    if not math.isfinite(ratio) or not MIN_RATIO <= ratio <= MAX_RATIO:
        raise RetuneError(
            f"Le rapport cible/source doit être compris entre {MIN_RATIO} et {MAX_RATIO}."
        )
    return ratio


def _run(argv: list[str], purpose: str, timeout: float | None = None) -> str:
    try:
        completed = subprocess.run(
            argv,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            shell=False,
        )
    except FileNotFoundError as exc:
        raise RetuneError(f"Exécutable introuvable : {argv[0]}.") from exc
    except subprocess.TimeoutExpired as exc:
        raise RetuneError(f"Délai dépassé pendant {purpose}.") from exc
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or "Erreur sans détail").strip()[-5000:]
        raise RetuneError(f"Échec pendant {purpose} :\n{detail}") from exc
    return completed.stdout


def _tools() -> tuple[str, str, str]:
    ffmpeg, ffprobe = shutil.which("ffmpeg"), shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:
        raise RetuneError("FFmpeg et ffprobe doivent être installés et accessibles dans PATH.")
    filters = _run([ffmpeg, "-hide_banner", "-filters"], "la vérification des filtres", 30)
    for name in ("rubberband", "alimiter"):
        if not re.search(rf"\b{re.escape(name)}\s+", filters):
            raise RetuneError(
                f"Filtre FFmpeg manquant : {name}. Une version avec librubberband est requise."
            )
    version = _run([ffmpeg, "-version"], "la lecture de version", 30).splitlines()[0]
    return ffmpeg, ffprobe, version


def probe(path: Path, ffprobe: str | None = None) -> dict[str, Any]:
    """Probe local files. The file-only protocol whitelist also blocks network playlists."""
    executable = ffprobe or shutil.which("ffprobe")
    if not executable:
        raise RetuneError("ffprobe est introuvable.")
    data = _run(
        [
            executable, "-v", "error", "-protocol_whitelist", "file",
            "-show_streams", "-show_format", "-of", "json", "-i", str(path),
        ],
        "l'analyse du fichier local",
        60,
    )
    try:
        result = json.loads(data)
    except json.JSONDecodeError as exc:
        raise RetuneError("ffprobe n'a pas renvoyé un document JSON valide.") from exc
    if not isinstance(result, dict) or not isinstance(result.get("streams"), list):
        raise RetuneError("ffprobe n'a pas fourni de liste de pistes valide.")
    return result


def _finite_float(value: Any) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return result if math.isfinite(result) else None


def _duration(stream: dict[str, Any]) -> float | None:
    value = _finite_float(stream.get("duration"))
    if value is not None and value >= 0:
        return value
    try:
        value = float(Fraction(str(stream["time_base"])) * int(stream["duration_ts"]))
        if math.isfinite(value) and value >= 0:
            return value
    except (KeyError, ValueError, ZeroDivisionError, TypeError, OverflowError):
        pass
    # Matroska's DURATION tag is not always a stream duration: do not guess.
    return None


def _first_streams(info: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any] | None]:
    audio = next((s for s in info["streams"] if s.get("codec_type") == "audio"), None)
    video = next(
        (
            s for s in info["streams"]
            if s.get("codec_type") == "video" and not s.get("disposition", {}).get("attached_pic")
        ),
        None,
    )
    if audio is None:
        raise RetuneError("Le fichier ne contient aucune piste audio.")
    return audio, video


def _summary(info: dict[str, Any], audio: dict[str, Any]) -> dict[str, Any]:
    return {
        "audio_codec": audio.get("codec_name"),
        "sample_rate": int(audio["sample_rate"]),
        "channels": int(audio["channels"]),
        "audio_duration_seconds": _duration(audio),
        "audio_start_seconds": _finite_float(audio.get("start_time")),
        "container_duration_seconds": _finite_float(info.get("format", {}).get("duration")),
        "container_start_seconds": _finite_float(info.get("format", {}).get("start_time")),
    }


def convert(
    source: str | Path,
    destination: str | Path,
    *,
    source_hz: float = 440.0,
    target_hz: float = 432.0,
    formants: str = "shifted",
) -> dict[str, Any]:
    """Write a new file and return a factual conversion report.

    Output publication uses a same-directory temporary file followed by an
    atomic, exclusive hard link. Existing destinations (including symlinks)
    are never overwritten. Filesystems without hard links fail explicitly.
    """
    ratio = tuning_ratio(source_hz, target_hz)
    if formants not in {"shifted", "preserved"}:
        raise RetuneError("Le réglage formants doit être 'shifted' ou 'preserved'.")
    source_raw, destination_raw = _local_path(source), _local_path(destination)
    if not source_raw.is_file():
        raise RetuneError("Le fichier source local est introuvable ou n'est pas un fichier ordinaire.")
    if os.path.lexists(destination_raw):
        raise RetuneError("La destination existe déjà ; aucun écrasement n'est autorisé.")
    try:
        source_path = source_raw.resolve(strict=True)
        destination_path = destination_raw.resolve(strict=False)
    except (OSError, RuntimeError) as exc:
        raise RetuneError(f"Chemin local invalide : {exc}") from exc
    if source_path == destination_path:
        raise RetuneError("La source et la destination doivent être différentes.")
    if not destination_path.parent.is_dir():
        raise RetuneError("Le dossier de destination doit déjà exister.")
    suffix = destination_path.suffix.lower()
    if suffix not in OUTPUT_SUFFIXES:
        raise RetuneError("Sorties prises en charge : .wav, .flac, .mkv et .mp4.")

    ffmpeg, ffprobe, ffmpeg_version = _tools()
    input_info = probe(source_path, ffprobe)
    audio, video = _first_streams(input_info)
    try:
        sample_rate, channels = int(audio["sample_rate"]), int(audio["channels"])
    except (KeyError, TypeError, ValueError) as exc:
        raise RetuneError("La fréquence d'échantillonnage ou les canaux audio sont inconnus.") from exc
    if sample_rate <= 0 or channels not in (1, 2):
        raise RetuneError("Cette version prend en charge l'audio mono ou stéréo à échantillonnage connu.")
    wants_video = suffix in {".mkv", ".mp4"}
    if wants_video and video is None:
        raise RetuneError("Une sortie vidéo exige une vraie piste vidéo (une pochette ne suffit pas).")

    filters = []
    if ratio != 1.0:
        filters.append(
            f"rubberband=tempo=1:pitch={ratio:.17g}:pitchq=quality:"
            f"channels=together:formant={formants}:transients=smooth:window=long:phase=laminar"
        )
    filters.append(
        f"alimiter=limit={LIMITER_CEILING:.17g}:level_in=1:level_out=1:"
        "level=false:latency=true:attack=5:release=50"
    )
    argv = [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin",
        "-protocol_whitelist", "file", "-copyts", "-start_at_zero", "-i", str(source_path),
    ]
    selected_indexes = {int(audio["index"])}
    if wants_video and video is not None:
        argv += ["-map", f"0:{video['index']}", "-c:v", "copy"]
        selected_indexes.add(int(video["index"]))
    argv += [
        "-map", f"0:{audio['index']}", "-af", ",".join(filters), "-ar", str(sample_rate),
        "-sn", "-dn", "-map_metadata", "-1", "-map_chapters", "-1",
        "-avoid_negative_ts", "disabled",
    ]
    if suffix == ".wav":
        argv += ["-c:a", "pcm_s24le", "-rf64", "auto"]
    elif suffix in {".flac", ".mkv"}:
        argv += ["-c:a", "flac", "-sample_fmt", "s32"]
    else:
        argv += ["-c:a", "aac", "-b:a", "256k" if channels == 2 else "128k", "-movflags", "+faststart"]

    temporary_path: Path | None = None
    try:
        fd, name = tempfile.mkstemp(prefix=".harmonie-", suffix=suffix, dir=destination_path.parent)
        os.close(fd)
        temporary_path = Path(name)
        # -y applies exclusively to our private, newly reserved temporary file.
        _run(argv + ["-y", str(temporary_path)], "la conversion audio locale")
        output_info = probe(temporary_path, ffprobe)
        output_audio, output_video = _first_streams(output_info)
        if int(output_audio.get("sample_rate", 0)) != sample_rate:
            raise RetuneError("Vérification échouée : l'échantillonnage a changé.")
        if int(output_audio.get("channels", 0)) != channels:
            raise RetuneError("Vérification échouée : le nombre de canaux a changé.")
        if wants_video and (output_video is None or output_video.get("codec_name") != video.get("codec_name")):
            raise RetuneError("Vérification échouée : la piste vidéo copiée n'est pas présente.")
        if temporary_path.stat().st_size == 0:
            raise RetuneError("Vérification échouée : la sortie est vide.")
        # Flush the new file before it becomes visible under its public name.
        with temporary_path.open("rb") as handle:
            os.fsync(handle.fileno())
        try:
            os.link(temporary_path, destination_path)
        except FileExistsError as exc:
            raise RetuneError("La destination a été créée entre-temps ; aucun écrasement effectué.") from exc
        except OSError as exc:
            raise RetuneError(
                "Publication atomique impossible sur ce dossier (liens physiques requis). "
                "Choisir un autre disque/dossier ; aucun fichier existant n'a été écrasé."
            ) from exc
    except OSError as exc:
        raise RetuneError(f"Erreur de fichier local : {exc}") from exc
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)

    before, after = _summary(input_info, audio), _summary(output_info, output_audio)
    source_duration, output_duration = before["audio_duration_seconds"], after["audio_duration_seconds"]
    duration_delta = output_duration - source_duration if source_duration is not None and output_duration is not None else None
    return {
        "status": "PASS",
        "scope": "Conversion de fichier local uniquement ; aucune validation acoustique physique.",
        "source": str(source_path),
        "destination": str(destination_path),
        "source_reference_hz_assumed": source_hz,
        "source_reference_measured": False,
        "target_reference_hz": target_hz,
        "pitch_ratio": ratio,
        "pitch_cents": 1200 * math.log2(ratio),
        "pitch_processing_applied": ratio != 1.0,
        "tempo_factor": 1.0,
        "formants": formants,
        "channels_processing": "together",
        "rubberband_profile": "pitchq=quality, transients=smooth, window=long, phase=laminar",
        "selected_audio_stream": int(audio["index"]),
        "selected_video_stream": int(video["index"]) if wants_video and video is not None else None,
        "omitted_streams": [int(s["index"]) for s in input_info["streams"] if int(s["index"]) not in selected_indexes],
        "video_encoding": "stream_copy" if wants_video else None,
        "chapters_and_metadata": "omitted",
        "audio_encoding_lossy": suffix == ".mp4",
        "limiter": {"sample_peak_ceiling_dbfs": -1, "automatic_gain": False, "latency_compensated": True, "true_peak_guarantee": False},
        "before": before,
        "after": after,
        "audio_duration_metadata_delta_seconds": duration_delta,
        "timestamp_policy": "copyts/start_at_zero : même origine temporelle pour les pistes sélectionnées",
        "notice": "La qualité perceptive, le décalage d'encodage AAC et la synchronisation sur le matériel restent à vérifier sur chaque média réel.",
        "ffmpeg_version": ffmpeg_version,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", help="Fichier local source ; jamais modifié.")
    parser.add_argument("destination", help="Nouveau fichier .wav, .flac, .mkv ou .mp4.")
    parser.add_argument("--source-hz", type=float, default=440.0, help="Référence d'origine supposée (défaut : 440).")
    parser.add_argument("--target-hz", type=float, default=432.0, help="Référence de destination (défaut : 432).")
    parser.add_argument("--formants", choices=("shifted", "preserved"), default="shifted")
    args = parser.parse_args(argv)
    try:
        report = convert(args.source, args.destination, source_hz=args.source_hz, target_hz=args.target_hz, formants=args.formants)
    except RetuneError as exc:
        print(f"BLOQUÉ — {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("PARTIEL — Conversion interrompue ; la source reste inchangée.", file=sys.stderr)
        return 130
    print(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
