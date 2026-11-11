#!/usr/bin/env python3
"""Create original, low-digital-level 432 Hz listening examples, locally.

These files illustrate synthesis, not universal device calibration or a health
effect. No streaming-service content is used. Existing outputs are preserved.
"""
from __future__ import annotations

import argparse
from array import array
import math
from pathlib import Path
import sys
import wave

SAMPLE_RATE = 48_000
TONE_HZ = 432.0
PURE_DURATION = 12
MELODY_DURATION = 24
MELODY = (0, 3, 7, 10, 7, 3, 5, 7, 12, 10, 7, 0)


def fade(t: float, duration: float, ramp: float = 0.08) -> float:
    edge = max(0.0, min(1.0, t / ramp, (duration - t) / ramp))
    return 0.5 - 0.5 * math.cos(math.pi * edge)


def sample(t: float, *, melody: bool) -> float:
    duration = MELODY_DURATION if melody else PURE_DURATION
    signal = (0.025 if melody else 0.08) * math.sin(2 * math.pi * TONE_HZ * t)
    if melody:
        note_index = min(int(t / 2), len(MELODY) - 1)
        local_t = t - 2 * note_index
        note_hz = 216.0 * 2 ** (MELODY[note_index] / 12)
        envelope = fade(local_t, 1.82, 0.07) if local_t < 1.82 else 0.0
        envelope *= math.exp(-0.6 * local_t)
        note = (math.sin(2 * math.pi * note_hz * local_t)
                + 0.18 * math.sin(4 * math.pi * note_hz * local_t)
                + 0.04 * math.sin(6 * math.pi * note_hz * local_t))
        signal += 0.07 * envelope * note / 1.22
    return fade(t, duration) * signal


def generate(destination: Path, *, melody: bool) -> dict[str, object]:
    duration = MELODY_DURATION if melody else PURE_DURATION
    values = array('h', (round(32767 * sample(i / SAMPLE_RATE, melody=melody))
                         for i in range(duration * SAMPLE_RATE)))
    if sys.byteorder != 'little':
        values.byteswap()
    # Exclusive creation prevents replacing a pre-existing listening file.
    with destination.open('xb') as file:
        with wave.open(file, 'wb') as writer:
            writer.setnchannels(1)
            writer.setsampwidth(2)
            writer.setframerate(SAMPLE_RATE)
            writer.writeframes(values.tobytes())
    return {'path': str(destination), 'seconds': duration,
            'sample_rate': SAMPLE_RATE, 'continuous_tone_hz': TONE_HZ,
            'melody_tuning_a4_hz': TONE_HZ if melody else None}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    args.directory.mkdir(parents=True, exist_ok=True)
    import json
    results = []
    for filename, melody in [('MUKTI_432Hz_son_pur.wav', False),
                             ('MUKTI_432Hz_melodie_et_tonalite.wav', True)]:
        results.append(generate(args.directory / filename, melody=melody))
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
