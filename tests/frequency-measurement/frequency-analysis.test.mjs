import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFrequency } from '../../src/lib/audio/frequency-analysis.ts';

const N = 32768;
// Independent time-domain fixtures: no FFT/estimator helpers are reused.
function signal(rate, tones, length = N, offset = 0) {
  return Float32Array.from({ length }, (_, i) =>
    offset + tones.reduce((sum, [hz, amplitude, phase = 0]) =>
      sum + amplitude * Math.sin((i / rate) * hz * 2 * Math.PI + phase), 0));
}
function noise(length = N) {
  let seed = 0x16b00b5;
  return Float32Array.from({ length }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed / 4294967296 - 0.5) * 0.4;
  });
}
for (const rate of [44100, 48000]) {
  for (const phase of [0.17, 1.93]) {
    test(`432 Hz is estimated near target at ${rate} Hz, phase ${phase}`, () => {
      const result = analyzeFrequency(signal(rate, [[432, 0.3, phase]]), rate);
      assert.equal(result.status, 'near_target');
      assert.ok(Math.abs(result.dominantHz - 432) < 0.2);
      assert.ok(result.tonalFraction > 0.99 && result.tonalFraction <= 1);
      assert.ok(Math.abs(result.rmsDbfs - 20 * Math.log10(0.3 / Math.sqrt(2))) < 0.05);
      assert.equal(result.binSpacingHz, rate / N);
      assert.equal(result.observationSeconds, N / rate);
    });
  }
  test(`wide-band 440 and 3100 Hz are off target at ${rate}`, () => {
    for (const hz of [440, 3100]) {
      const result = analyzeFrequency(signal(rate, [[hz, 0.25, 0.41]]), rate);
      assert.equal(result.status, 'off_target');
      assert.ok(Math.abs(result.dominantHz - hz) < 0.2);
    }
  });
  test(`216 Hz plus strong 432 harmonic is uncertain at ${rate}`, () => {
    const result = analyzeFrequency(signal(rate, [[216, 0.05, 1.2], [432, 0.6, 0.42]]), rate);
    assert.equal(result.status, 'uncertain');
    assert.ok(Math.abs(result.dominantHz - 432) < 0.2);
    assert.match(result.reason, /harmoniques/);
  });
  test(`two close tones 432 + 440 are uncertain at ${rate}`, () => {
    for (const amplitude of [0.3, 0.02]) {
      const result = analyzeFrequency(signal(rate, [[432, 0.3, 0.3], [440, amplitude, 2.1]]), rate);
      assert.equal(result.status, 'uncertain');
    }
  });
  test(`noise and a noisy tone are uncertain at ${rate}`, () => {
    assert.equal(analyzeFrequency(noise(), rate).status, 'uncertain');
    const mixed = signal(rate, [[432, 0.2, 1.1]]);
    const random = noise();
    for (let i = 0; i < mixed.length; i++) mixed[i] += random[i];
    assert.equal(analyzeFrequency(mixed, rate).status, 'uncertain');
  });
}
test('zero and sub-threshold signals are silence, with no invented frequency', () => {
  for (const samples of [new Float32Array(N), signal(48000, [[432, 0.00001]])]) {
    const result = analyzeFrequency(samples, 48000);
    assert.equal(result.status, 'silence');
    assert.equal(result.dominantHz, null);
    assert.equal(result.tonalFraction, null);
  }
  assert.equal(analyzeFrequency(new Float32Array(N), 48000).rmsDbfs, null);
});
test('constant DC and excessive DC offset remain uncertain', () => {
  assert.equal(analyzeFrequency(new Float32Array(N).fill(0.2), 48000).status, 'uncertain');
  assert.equal(analyzeFrequency(signal(48000, [[432, 0.1]], N, 0.3), 48000).status, 'uncertain');
});
test('clipped and out-of-range samples are rejected before frequency inference', () => {
  const clipped = signal(48000, [[432, 1.5]]).map(value => Math.max(-1, Math.min(1, value)));
  for (const samples of [clipped, signal(48000, [[432, 1.2]])]) {
    const result = analyzeFrequency(samples, 48000);
    assert.equal(result.status, 'clipped');
    assert.equal(result.dominantHz, null);
  }
});
test('non-finite samples do not result in a tone or non-finite measurement', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    const samples = signal(48000, [[432, 0.2]]);
    samples[123] = value;
    const result = analyzeFrequency(samples, 48000);
    assert.equal(result.status, 'uncertain');
    assert.equal(result.dominantHz, null);
    assert.equal(result.rmsDbfs, null);
  }
});
test('the supplied effective sample rate is used, not a hard-coded nominal rate', () => {
  const samples = signal(48000, [[432, 0.3, 0.8]]);
  const result = analyzeFrequency(samples, 44100);
  assert.equal(result.status, 'off_target');
  assert.ok(Math.abs(result.dominantHz - 432 * 44100 / 48000) < 0.2);
});
test('short, non power-of-two, wrong-type, excessive frames and rates are refused', () => {
  for (const [samples, rate] of [
    [new Float32Array(0), 48000], [new Float32Array(512), 48000],
    [signal(48000, [[432, 0.3]], 2048), 48000],
    [signal(48000, [[432, 0.3]], 16384), 48000],
    [new Float32Array(32767), 48000], [new Float32Array(262144), 48000],
    [[0, 1], 48000], [null, 48000], [new Float32Array(N), NaN],
    [new Float32Array(N), 0], [new Float32Array(N), Infinity],
    [new Float32Array(N), 1000], [new Float32Array(N), 384000],
  ]) {
    const result = analyzeFrequency(samples, rate);
    assert.equal(result.status, 'uncertain');
    assert.equal(result.dominantHz, null);
    assert.ok(Number.isFinite(result.observationSeconds));
    assert.ok(Number.isFinite(result.binSpacingHz));
  }
});
test('invalid or unobservable targets are refused and other valid targets work', () => {
  const samples = signal(48000, [[440, 0.3, 0.9]]);
  for (const target of [NaN, Infinity, 0, -432, 39, 7000]) {
    assert.equal(analyzeFrequency(samples, 48000, target).status, 'uncertain');
  }
  assert.equal(analyzeFrequency(samples, 48000, 440).status, 'near_target');
});
test('strong out-of-band energy cannot be called a pure in-band tone', () => {
  for (const hz of [20, 9000]) {
    const result = analyzeFrequency(signal(48000, [[hz, 0.4], [432, 0.03, 1]]), 48000);
    assert.equal(result.status, 'uncertain');
  }
});
