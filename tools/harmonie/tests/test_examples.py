#!/usr/bin/env python3
"""Independent waveform inspection of generated listening examples (requires numpy)."""
import argparse
import json
from pathlib import Path
import wave

import numpy as np


def inspect(path: Path, seconds: int, melody: bool) -> dict:
    with wave.open(str(path), 'rb') as stream:
        rate = stream.getframerate()
        channels = stream.getnchannels()
        assert stream.getsampwidth() == 2
        audio = np.frombuffer(stream.readframes(stream.getnframes()), dtype='<i2').astype(float) / 32768
    assert channels == 1
    assert len(audio) / rate == seconds
    peak = float(np.abs(audio).max())
    assert 0 < peak < 0.11
    assert abs(audio[0]) < 1e-4 and abs(audio[-1]) < 1e-4
    windows = [(1.0, 10.0)] if not melody else [(i * 2 + 1.84, i * 2 + 1.97) for i in range(12)]
    estimates = []
    for start, end in windows:
        signal = audio[int(start * rate):int(end * rate)]
        crossing_indices = np.where((signal[:-1] <= 0) & (signal[1:] > 0))[0]
        assert len(crossing_indices) > 40
        crossings = crossing_indices - signal[crossing_indices] / (signal[crossing_indices + 1] - signal[crossing_indices])
        hz = float(rate * (len(crossings) - 1) / (crossings[-1] - crossings[0]))
        assert abs(hz - 432) < 0.02, hz
        estimates.append(hz)
    if melody:
        # Inspect a different musical note; the continuous 432 tone must not
        # replace the melody. This is an output spectrum, not a code assertion.
        signal = audio[int(4.2 * rate):int(5.5 * rate)]
        spectrum = np.abs(np.fft.rfft(signal * np.hanning(len(signal)), n=262144))
        frequencies = np.fft.rfftfreq(262144, 1 / rate)
        region = (frequencies > 310) & (frequencies < 335)
        note_hz = float(frequencies[region][np.argmax(spectrum[region])])
        assert abs(note_hz - 323.6343310022432) < 0.3
    else:
        note_hz = None
    return {'filename': path.name, 'status': 'PASS', 'duration_seconds': seconds,
            'sample_rate': rate, 'channels': channels, 'digital_peak': peak,
            'tone_estimates_hz': estimates, 'melody_note_estimate_hz': note_hz,
            'scope': 'PCM files only; no physical loudspeaker or phone tested'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('directory', type=Path)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    results = [inspect(args.directory / 'MUKTI_432Hz_son_pur.wav', 12, False),
               inspect(args.directory / 'MUKTI_432Hz_melodie_et_tonalite.wav', 24, True)]
    text = json.dumps({'status': 'PASS', 'checks': results}, ensure_ascii=False, indent=2)
    if args.report:
        args.report.write_text(text + '\n')
    print(text)
