"""End-to-end checks on synthetic fixtures, not claims about arbitrary music.

Run: python tools/harmonie/tests/test_retune.py --report validation/harmonie-tests.json
Optional: --samples DIR keeps a short original melody and its 432 Hz conversion.
Test dependency: numpy. Production retune.py uses the Python standard library only.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile
import unittest
import wave

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import retune  # noqa: E402


def command(argv: list[str], *, binary: bool = False):
    return subprocess.run(argv, check=True, capture_output=True, text=not binary, shell=False).stdout


def write_pcm(path: Path, values: np.ndarray, sample_rate: int) -> None:
    values = np.asarray(values)
    if values.ndim == 1:
        values = values[:, None]
    with wave.open(str(path), "wb") as stream:
        stream.setparams((values.shape[1], 2, sample_rate, 0, "NONE", ""))
        stream.writeframes(np.round(np.clip(values, -1, 1) * 32767).astype("<i2").tobytes())


def decode(path: Path) -> tuple[np.ndarray, int]:
    info = retune.probe(path)
    stream = next(s for s in info["streams"] if s["codec_type"] == "audio")
    pcm = command([
        "ffmpeg", "-v", "error", "-nostdin", "-protocol_whitelist", "file,pipe",
        "-i", str(path), "-map", f"0:{stream['index']}", "-vn", "-c:a", "pcm_f32le",
        "-f", "f32le", "pipe:1",
    ], binary=True)
    return np.frombuffer(pcm, dtype="<f4").reshape(-1, int(stream["channels"])), int(stream["sample_rate"])


def peak_frequency(signal: np.ndarray, sample_rate: int) -> float:
    # Measure the steady middle; startup/transient behaviour is tested separately.
    steady = signal[sample_rate:-sample_rate]
    spectrum = np.abs(np.fft.rfft(steady * np.hanning(len(steady))))
    index = int(np.argmax(spectrum))
    # Parabolic interpolation in log magnitude reduces bin quantisation.
    offset = 0.0
    if 0 < index < len(spectrum) - 1:
        left, center, right = np.log(np.maximum(spectrum[index-1:index+2], 1e-30))
        denominator = left - 2 * center + right
        if denominator:
            offset = 0.5 * (left - right) / denominator
    return (index + offset) * sample_rate / len(steady)


def video_frame_hashes(path: Path) -> list[str]:
    text = command([
        "ffmpeg", "-v", "error", "-nostdin", "-protocol_whitelist", "file,pipe",
        "-i", str(path), "-map", "0:v:0", "-an", "-f", "framemd5", "pipe:1",
    ])
    return [line.split(",")[-1].strip() for line in text.splitlines() if line and not line.startswith("#")]


def video_packets(path: Path) -> list[dict]:
    return json.loads(command([
        "ffprobe", "-v", "error", "-protocol_whitelist", "file", "-select_streams", "v:0",
        "-show_packets", "-show_entries", "packet=pts_time,dts_time,duration_time,data_hash",
        "-show_data_hash", "sha256", "-of", "json", "-i", str(path),
    ]))["packets"]


class RetuneEndToEnd(unittest.TestCase):
    metrics: dict = {}

    @classmethod
    def setUpClass(cls):
        for name in ("ffmpeg", "ffprobe"):
            if not shutil.which(name):
                raise unittest.SkipTest(f"{name} absent")
        cls.folder = tempfile.TemporaryDirectory(prefix="harmonie-e2e-")
        cls.root = Path(cls.folder.name)
        cls.sample_rate = 48000
        t = np.arange(cls.sample_rate * 5) / cls.sample_rate
        cls.stereo = cls.root / "stereo_440_880.wav"
        values = 0.2 * np.column_stack((np.sin(2*np.pi*440*t), np.sin(2*np.pi*880*t)))
        write_pcm(cls.stereo, values, cls.sample_rate)
        cls.second_audio = cls.root / "second_audio_220.wav"
        write_pcm(cls.second_audio, 0.2*np.sin(2*np.pi*220*t), cls.sample_rate)
        # A delayed first audio track, a second audio track, H.264 B-frames, and
        # video longer than audio exercise timeline preservation and selection.
        cls.video = cls.root / "video_two_audio_tracks.mkv"
        command([
            "ffmpeg", "-v", "error", "-nostdin", "-f", "lavfi", "-i",
            "testsrc2=size=160x90:rate=25:duration=6",
            "-itsoffset", "0.25", "-i", str(cls.stereo), "-i", str(cls.second_audio),
            "-map", "0:v:0", "-map", "1:a:0", "-map", "2:a:0",
            "-c:v", "libx264", "-bf", "2", "-pix_fmt", "yuv420p",
            "-c:a", "flac", str(cls.video),
        ])

    @classmethod
    def tearDownClass(cls):
        cls.folder.cleanup()

    def test_stereo_tones_wav_and_flac(self):
        results = []
        for suffix in (".wav", ".flac"):
            with self.subTest(format=suffix):
                output = self.root / ("retuned_stereo" + suffix)
                report = retune.convert(self.stereo, output)
                pcm, sample_rate = decode(output)
                frequencies = [peak_frequency(pcm[:, i], sample_rate) for i in range(2)]
                self.assertEqual(sample_rate, 48000)
                self.assertEqual(pcm.shape, (240000, 2))
                self.assertAlmostEqual(frequencies[0], 432, delta=0.1)
                self.assertAlmostEqual(frequencies[1], 864, delta=0.1)
                self.assertLess(float(np.max(np.abs(pcm))), 0.3)
                self.assertFalse(report["limiter"]["automatic_gain"])
                results.append({"format": suffix, "measured_hz": frequencies, "frames": len(pcm), "sample_rate": sample_rate, "peak": float(np.max(np.abs(pcm)))})
        self.metrics["stereo_440_880_to_432_864"] = results

    def test_mono_44100_preserves_sample_rate_and_duration(self):
        sample_rate = 44100
        t = np.arange(sample_rate*5)/sample_rate
        source = self.root / "mono44100.wav"
        output = self.root / "mono44100_432.wav"
        write_pcm(source, 0.12*np.sin(2*np.pi*440*t), sample_rate)
        retune.convert(source, output)
        pcm, actual_rate = decode(output)
        self.assertEqual(actual_rate, sample_rate)
        self.assertEqual(pcm.shape, (len(t), 1))
        self.assertAlmostEqual(peak_frequency(pcm[:, 0], sample_rate), 432, delta=0.1)
        self.metrics["mono44100"] = {"frames": len(pcm), "sample_rate": actual_rate, "measured_hz": peak_frequency(pcm[:, 0], sample_rate)}

    def test_already_432_bypasses_pitch_processor(self):
        t = np.arange(self.sample_rate*5)/self.sample_rate
        source, output = self.root / "already432.wav", self.root / "still432.wav"
        write_pcm(source, 0.2*np.sin(2*np.pi*432*t), self.sample_rate)
        report = retune.convert(source, output, source_hz=432, target_hz=432)
        original, _ = decode(source)
        converted, sample_rate = decode(output)
        self.assertFalse(report["pitch_processing_applied"])
        self.assertEqual(report["pitch_ratio"], 1)
        self.assertEqual(converted.shape, original.shape)
        error = float(np.max(np.abs(original-converted)))
        self.assertLess(error, 2e-6)
        self.assertAlmostEqual(peak_frequency(converted[:, 0], sample_rate), 432, delta=0.1)
        self.metrics["ratio_one"] = {"maximum_sample_difference": error, "frames": len(converted)}

    def test_video_mkv_mp4_preserves_images_and_timeline(self):
        original_frames = video_frame_hashes(self.video)
        original_packets = video_packets(self.video)
        before = retune.probe(self.video)
        input_audio = next(s for s in before["streams"] if s["codec_type"] == "audio")
        results = []
        for suffix in (".mkv", ".mp4"):
            with self.subTest(format=suffix):
                output = self.root / ("video432"+suffix)
                report = retune.convert(self.video, output)
                after = retune.probe(output)
                output_audio = next(s for s in after["streams"] if s["codec_type"] == "audio")
                actual_packets = video_packets(output)
                self.assertEqual(video_frame_hashes(output), original_frames)
                self.assertEqual(len(actual_packets), len(original_packets))
                max_pts_error = max(abs(float(a["pts_time"])-float(b["pts_time"])) for a, b in zip(original_packets, actual_packets))
                self.assertLess(max_pts_error, 0.0011)
                container_duration_error = abs(float(after["format"]["duration"])-float(before["format"]["duration"]))
                self.assertLess(container_duration_error, 0.03)
                audio_start_error = float(output_audio["start_time"])-float(input_audio["start_time"])
                self.assertLess(abs(audio_start_error), 0.025)  # one AAC priming frame maximum
                self.assertEqual(sum(s["codec_type"] == "audio" for s in after["streams"]), 1)
                self.assertEqual(len(after["streams"]), 2)
                self.assertEqual(report["omitted_streams"], [2])
                pcm, sample_rate = decode(output)
                self.assertEqual(sample_rate, self.sample_rate)
                measured = [peak_frequency(pcm[:, i], sample_rate) for i in range(2)]
                self.assertAlmostEqual(measured[0], 432, delta=0.1)
                self.assertAlmostEqual(measured[1], 864, delta=0.1)
                # AAC can retain both encoder priming and tail padding when
                # the track starts after t=0; these are at most two 1024-sample
                # frames in this fixture. Container and content timing are
                # checked independently, not inferred from raw decode length.
                duration_tolerance = 2*1024/sample_rate + 0.001 if suffix == ".mp4" else 1/sample_rate
                self.assertLessEqual(abs(len(pcm)/sample_rate - 5), duration_tolerance)
                results.append({
                    "format": suffix, "decoded_video_frames_identical": len(original_frames),
                    "video_packet_hashes_identical": [p["data_hash"] for p in original_packets] == [p["data_hash"] for p in actual_packets],
                    "max_video_pts_error_seconds": max_pts_error,
                    "audio_start_metadata_delta_seconds": audio_start_error,
                    "container_duration_delta_seconds": container_duration_error,
                    "decoded_audio_duration_seconds": len(pcm)/sample_rate,
                    "measured_audio_hz": measured,
                    "audio_tracks_in_output": 1,
                })
        self.metrics["video"] = results

    def test_transient_content_alignment_and_no_drift(self):
        sample_rate = self.sample_rate
        t = np.arange(sample_rate*5)/sample_rate
        centers = (0.6, 2.5, 4.4)
        envelope = sum(np.exp(-((t-center)/0.035)**2) for center in centers)
        source = self.root / "timing_pulses.wav"
        source_video = self.root / "timing_pulses_video.mkv"
        write_pcm(source, 0.2*envelope*np.sin(2*np.pi*440*t), sample_rate)
        command([
            "ffmpeg", "-v", "error", "-nostdin", "-f", "lavfi", "-i",
            "testsrc2=size=160x90:rate=25:duration=6",
            "-itsoffset", "0.25", "-i", str(source), "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "libx264", "-bf", "2", "-c:a", "flac", str(source_video),
        ])
        original, _ = decode(source)

        def energy_peak_times(signal, approximate_centers):
            times = []
            for center in approximate_centers:
                first, last = int((center-0.2)*sample_rate), int((center+0.2)*sample_rate)
                energy = np.convolve(signal[first:last]**2, np.ones(481)/481, mode="same")
                times.append((first+int(np.argmax(energy)))/sample_rate)
            return times

        original_peaks = energy_peak_times(original[:, 0], centers)
        measurements = []
        for input_path, suffix in ((source, ".wav"), (source_video, ".mp4")):
            with self.subTest(format=suffix):
                output = self.root / ("timing_converted"+suffix)
                retune.convert(input_path, output)
                converted, rate = decode(output)
                self.assertEqual(rate, sample_rate)
                info = retune.probe(output)
                audio = next(s for s in info["streams"] if s["codec_type"] == "audio")
                # PTS plus decoded content positions includes AAC priming.
                output_start = float(audio.get("start_time", 0))
                input_start = 0.25 if suffix == ".mp4" else 0
                found = energy_peak_times(converted[:, 0], centers)
                offsets = [found[i]+output_start-original_peaks[i]-input_start for i in range(3)]
                self.assertLess(max(abs(v) for v in offsets), 0.015)
                self.assertLess(abs(offsets[-1]-offsets[0]), 0.005)
                measurements.append({"format": suffix, "energy_peak_timing_deltas_seconds": offsets, "first_to_last_drift_seconds": offsets[-1]-offsets[0]})
        self.metrics["transient_timing"] = measurements

    def test_limiter_caps_high_level_without_automatic_gain(self):
        t = np.arange(self.sample_rate*5)/self.sample_rate
        source, output = self.root / "high_level.wav", self.root / "limited.wav"
        write_pcm(source, 0.99*np.sin(2*np.pi*440*t), self.sample_rate)
        retune.convert(source, output)
        pcm, _ = decode(output)
        peak = float(np.max(np.abs(pcm)))
        self.assertLessEqual(peak, retune.LIMITER_CEILING+2e-6)
        self.assertGreater(peak, 0.85)
        self.metrics["limiter"] = {"measured_sample_peak": peak, "ceiling": retune.LIMITER_CEILING, "true_peak_tested": False}

    def test_existing_destination_and_source_are_never_overwritten(self):
        output = self.root / "protected.wav"
        output.write_bytes(b"existing destination must not change")
        original_source_hash = hashlib.sha256(self.stereo.read_bytes()).hexdigest()
        for source, destination in ((self.stereo, output), (self.stereo, self.stereo)):
            with self.subTest(destination=str(destination)):
                with self.assertRaises(retune.RetuneError):
                    retune.convert(source, destination)
        self.assertEqual(output.read_bytes(), b"existing destination must not change")
        self.assertEqual(hashlib.sha256(self.stereo.read_bytes()).hexdigest(), original_source_hash)
        if hasattr(os, "symlink"):
            dangling = self.root / "dangling.wav"
            dangling.symlink_to(self.root / "absent-target.wav")
            with self.assertRaises(retune.RetuneError):
                retune.convert(self.stereo, dangling)
            self.assertTrue(dangling.is_symlink())
            self.assertFalse((self.root/"absent-target.wav").exists())

    def test_urls_protocols_and_invalid_references_are_rejected(self):
        destination = self.root / "must_not_exist.wav"
        for url in ("https://example.com/song.mp3", "file:///tmp/song.wav", "concat:first|second", "pipe:0", "-", "//server/music.wav"):
            with self.subTest(url=url), self.assertRaises(retune.RetuneError):
                retune.convert(url, destination)
        with self.assertRaises(retune.RetuneError):
            retune.convert(self.stereo, "https://example.com/out.wav")
        for source_hz, target_hz in ((0, 432), (-440, 432), (math.nan, 432), (math.inf, 432), (440, math.nan), (440, math.inf), (440, 1), (440, 1000)):
            with self.subTest(source=source_hz, target=target_hz), self.assertRaises(retune.RetuneError):
                retune.convert(self.stereo, destination, source_hz=source_hz, target_hz=target_hz)
        self.assertFalse(destination.exists())

    def test_local_playlist_cannot_open_network_protocol(self):
        source = self.root / "network_playlist.m3u8"
        source.write_text("#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:5\n#EXTINF:5,\nhttps://127.0.0.1:9/forbidden.ts\n#EXT-X-ENDLIST\n")
        destination = self.root / "playlist_out.wav"
        with self.assertRaises(retune.RetuneError) as error:
            retune.convert(source, destination)
        self.assertIn("whitelist", str(error.exception).lower())
        self.assertFalse(destination.exists())

    def test_shell_metacharacters_are_literal_filenames_and_cli_reports_json(self):
        source = self.root / "tone $(touch SHOULD_NOT_EXIST).wav"
        output = self.root / "converted `touch ALSO_NOT_CREATED`.flac"
        shutil.copyfile(self.stereo, source)
        completed = subprocess.run([
            sys.executable, str(Path(retune.__file__)), str(source), str(output),
        ], capture_output=True, text=True, check=True, shell=False, cwd=self.root)
        report = json.loads(completed.stdout)
        self.assertEqual(report["status"], "PASS")
        self.assertTrue(output.is_file())
        self.assertFalse((self.root/"SHOULD_NOT_EXIST").exists())
        self.assertFalse((self.root/"ALSO_NOT_CREATED").exists())

    def test_failed_conversion_leaves_no_published_output_or_temporary_file(self):
        source = self.root / "not_audio.wav"
        source.write_bytes(b"This is not a media file.")
        output = self.root / "failure.wav"
        with self.assertRaises(retune.RetuneError):
            retune.convert(source, output)
        self.assertFalse(output.exists())
        self.assertEqual(list(self.root.glob(".harmonie-*")), [])


def save_melody(directory: Path) -> dict:
    directory.mkdir(parents=True, exist_ok=True)
    sample_rate, note_duration = 48000, 0.65
    # Original synthetic six-note phrase; no third-party recording.
    notes = [0, 3, 7, 10, 7, 3, 0, -5]
    parts = []
    for semitones in notes:
        t = np.arange(round(sample_rate*note_duration))/sample_rate
        envelope = np.minimum(t/0.04, 1)*np.minimum((note_duration-t)/0.12, 1)
        frequency = 440*2**(semitones/12)
        fundamental = np.sin(2*np.pi*frequency*t)
        overtone = 0.15*np.sin(2*np.pi*frequency*2*t)
        parts.append(0.12*envelope*(fundamental+overtone))
    melody = np.concatenate(parts)
    stereo = np.column_stack((melody, melody))
    original = directory/"melodie_originale_reference_440.wav"
    converted = directory/"melodie_reaccordee_reference_432.wav"
    if original.exists() or converted.exists():
        raise RuntimeError("Les exemples d'écoute existent déjà ; aucun écrasement effectué.")
    write_pcm(original, stereo, sample_rate)
    report = retune.convert(original, converted)
    return {"original": str(original), "converted": str(converted), "duration_seconds": len(melody)/sample_rate, "conversion": report}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--samples", type=Path)
    options = parser.parse_args()
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(RetuneEndToEnd)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    payload = {
        "status": "PASS" if result.wasSuccessful() and result.testsRun else "FAIL",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "tests_run": result.testsRun,
        "failures": [{"test": str(t), "detail": message} for t, message in result.failures],
        "errors": [{"test": str(t), "detail": message} for t, message in result.errors],
        "skipped": [{"test": str(t), "reason": reason} for t, reason in result.skipped],
        "environment": {"python": sys.version, "platform": platform.platform(), "numpy": np.__version__, "ffmpeg": command(["ffmpeg", "-version"]).splitlines()[0], "ffprobe": command(["ffprobe", "-version"]).splitlines()[0]},
        "fixtures": "Synthetic PCM tones, Gaussian-envelope tone pulses and synthetic image/video only.",
        "not_tested": ["Physical acoustic output", "iOS/Android/macOS/Windows runtime", "Bluetooth/wired devices", "DRM and streaming services", "All music styles", "Multichannel audio", "True-peak safety after AAC encoding"],
        "measurements": RetuneEndToEnd.metrics,
    }
    if options.samples and result.wasSuccessful():
        payload["listening_samples"] = save_melody(options.samples.resolve())
    if options.report:
        options.report.parent.mkdir(parents=True, exist_ok=True)
        options.report.write_text(json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False)+"\n")
    print(json.dumps({"status": payload["status"], "tests_run": result.testsRun, "report": str(options.report) if options.report else None}))
    sys.exit(0 if result.wasSuccessful() and result.testsRun else 1)
