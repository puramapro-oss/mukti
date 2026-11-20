"""Independent numerical verification of the real vendored WASM output.

Run after `node render-dsp-cases.cjs DIRECTORY`.
Requires numpy and scipy. Browser/device validation is deliberately excluded.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from scipy.signal import find_peaks


def frequency(samples, rate):
    samples = samples.astype(float)
    windowed = (samples - np.mean(samples)) * np.hanning(len(samples))
    count = 2 ** math.ceil(math.log2(len(samples) * 8))
    spectrum = np.abs(np.fft.rfft(windowed, n=count))
    peak = int(np.argmax(spectrum[1:]) + 1)
    if peak < len(spectrum) - 1:
        a, b, c = np.log(np.maximum(spectrum[peak-1:peak+2], 1e-30))
        correction = .5 * (a - c) / (a - 2*b + c)
    else:
        correction = 0
    return float((peak + correction) * rate / count)


directory = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/mukti-harmonie-dsp')
manifest = json.loads((directory / 'manifest.json').read_text())
checks = []
for case in manifest['cases']:
    channels = [np.fromfile(directory / filename, dtype='<f4') for filename in case['files']]
    rate = case['sampleRate']
    assert all(np.isfinite(channel).all() for channel in channels), case['name'] + ': non-finite samples'
    middle = [channel[int((case['startAt'] + .5)*rate):int((case['startAt'] + 3.5)*rate)] for channel in channels]
    if case['name'] == 'silence':
        maximum = max(float(np.max(np.abs(channel))) for channel in channels)
        assert maximum == 0, 'silence contains non-zero samples'
        checks.append({'test': case['name'], 'status': 'PASS', 'maximum_abs_sample': maximum})
    elif case['name'] == 'tempo-pulses':
        energy = np.convolve(channels[0].astype(float) ** 2, np.ones(480)/480, mode='same')
        peaks, _ = find_peaks(energy, distance=int(.3*rate), height=.001)
        times = peaks / rate - case['startAt']
        assert len(times) == len(case['pulseTimes']), f'wrong pulse count: {times}'
        errors = times - np.array(case['pulseTimes'])
        intervals = np.diff(times)
        assert float(np.max(np.abs(intervals - .5))) < .015, f'tempo drift {intervals}'
        assert float(np.max(np.abs(errors))) < .03, f'buffer timing {errors}'
        checks.append({'test': case['name'], 'status': 'PASS', 'pulse_positions_seconds': times.tolist(), 'max_interval_error_seconds': float(np.max(np.abs(intervals - .5))), 'max_position_error_seconds': float(np.max(np.abs(errors)))})
    elif case['name'] == 'stop-flush':
        # The raw phase-vocoder has both analysis and synthesis tails. The app
        # separately fades/disconnects its output; this test checks DSP drainage.
        flush_seconds = 2 * case['latency'] + .1
        after = [channel[int((case['stopAt'] + flush_seconds)*rate):] for channel in channels]
        maximum = max(float(np.max(np.abs(channel))) for channel in after)
        assert maximum < 1e-6, f'stop did not flush: {maximum}'
        checks.append({'test': case['name'], 'status': 'PASS', 'stop_at_seconds': case['stopAt'], 'raw_dsp_flush_wait_seconds': flush_seconds, 'maximum_after_flush': maximum, 'note': 'Raw DSP tail only; browser stop/fade remains to validate on a real browser.'})
    else:
        measured = [frequency(channel, rate) for channel in middle]
        errors = [actual - expected for actual, expected in zip(measured, case['expected'])]
        cents = [1200 * math.log2(actual / expected) for actual, expected in zip(measured, case['expected'])]
        assert max(abs(error) for error in cents) < 1, (case['name'], measured, cents)
        for actual, expected in zip(measured, case['expected']):
            if expected == 432:
                assert abs(actual - expected) < .1, (case['name'], measured, errors)
        check = {'test': case['name'], 'status': 'PASS', 'expected_hz': case['expected'], 'measured_hz': measured, 'error_hz': errors, 'error_cents': cents}
        if case['name'] == 'stereo-440-660':
            # Independent channel identity: output waveforms must not collapse.
            correlation = float(np.corrcoef(middle[0], middle[1])[0, 1])
            assert abs(correlation) < .1, f'stereo channels collapsed: {correlation}'
            check['channel_correlation'] = correlation
        checks.append(check)

rejected_case = manifest['rejected']
rejected_data = np.fromfile(directory / rejected_case['files'][0], dtype='<f4')
rejected_frequency = frequency(rejected_data[int(.75*48000):int(3.75*48000)], 48000)

report = {
    'scope': manifest['host'],
    'browser_validation': 'NON TESTÉ — no installed browser executable in this environment',
    'physical_output_validation': 'NON TESTÉ — no microphone, phone, tablet, speaker or headphones connected',
    'vendor': 'Signalsmith Stretch Web 1.3.2',
    'pitch_ratio': 432/440,
    'pitch_cents': 1200*math.log2(432/440),
    'sample_rate_hz': manifest['sampleRate'],
    'live_configuration': {'block_ms': 320, 'interval_ms': 80, 'latency_seconds': .32, 'tonality_hz': 0, 'rate': 1, 'formant_compensation': False},
    'acceptance_criteria': {'musical_frequency_error_cents_max': 1, 'a432_error_hz_max': .1, 'note': 'A musical pitch shifter is approximate. This is not a laboratory 432 Hz tone generator.'},
    'rejected_design': {'configuration': 'Vendor buffer mode, default 120 ms block', 'expected_hz': 432, 'measured_hz': rejected_frequency, 'status': 'FAIL — rejected, not counted as passed', 'reason': 'Buffer seek introduced a repeatable pitch error; current prototype uses live input and a 320 ms block. No empirical pitch-ratio correction.'},
    'all_passed': True,
    'checks': checks,
}
destination = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).with_name('verification.json')
destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
