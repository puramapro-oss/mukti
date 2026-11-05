const fs = require('node:fs');
const path = require('node:path');
const {createProcessor, render} = require('./dsp-host.cjs');
const directory = path.resolve(process.argv[2] || '/tmp/mukti-harmonie-dsp');
const sampleRate = 48000;
const seconds = 4;
const sine = (hz, duration = seconds) => Float32Array.from({length: sampleRate * duration}, (_, i) => .2 * Math.sin(2 * Math.PI * hz * i / sampleRate));
const cases = [
  {name: 'a440-to-a432', channels: [sine(440)], expected: [432, 432]},
  {name: 'a880-to-a864', channels: [sine(880)], expected: [864, 864]},
  {name: 'high-12000-strict-ratio', channels: [sine(12000)], expected: [12000 * 432 / 440, 12000 * 432 / 440]},
  {name: 'stereo-440-660', channels: [sine(440), sine(660)], expected: [432, 648]},
  {name: 'already-432-no-double-shift', channels: [sine(432)], sourceHz: 432, expected: [432, 432]},
  {name: 'silence', channels: [new Float32Array(sampleRate * seconds)], expected: [0, 0]},
];

function save(name, result, expected) {
  const files = result.channels.map((channel, i) => {
    const nameWithChannel = `${name}-${i}.f32`;
    fs.writeFileSync(path.join(directory, nameWithChannel), Buffer.from(channel.buffer));
    return nameWithChannel;
  });
  return {name, expected, files, sampleRate: result.sampleRate, startAt: result.startAt, duration: result.duration, latency: result.latency, inputMode: result.inputMode || 'live', blockMs: result.blockMs || 320};
}

(async () => {
  fs.mkdirSync(directory, {recursive: true});
  const manifest = [];
  for (const testcase of cases) {
    const result = await render({...testcase, sampleRate});
    manifest.push(save(testcase.name, result, testcase.expected));
  }
  const pulses = new Float32Array(sampleRate * seconds);
  const pulseTimes = [.5, 1, 1.5, 2, 2.5, 3];
  for (let i = 0; i < pulses.length; i++) {
    const t = i / sampleRate;
    for (const center of pulseTimes) {
      if (Math.abs(t - center) < .055) pulses[i] += .2 * Math.cos(Math.PI * (t - center) / .11) ** 2 * Math.sin(2 * Math.PI * 440 * t);
    }
  }
  manifest.push({...save('tempo-pulses', await render({channels: [pulses], sampleRate}), []), pulseTimes});

  const host = await createProcessor(sampleRate);
  host.call('configure', {blockMs: 320, intervalMs: 80});
  host.call('schedule', {input: 0, output: .25, active: true, rate: 1, semitones: 12 * Math.log2(432 / 440), tonalityHz: 0, formantCompensation: false});
  const out = [new Float32Array(sampleRate * 3), new Float32Array(sampleRate * 3)];
  let stopped = false;
  let stopAt;
  for (let i = 0; i < out[0].length; i += 128) {
    host.sandbox.currentTime = i / sampleRate;
    if (!stopped && host.sandbox.currentTime >= 1.25) {
      stopAt = host.sandbox.currentTime;
      host.call('stop', stopAt);
      stopped = true;
    }
    const block = [new Float32Array(128), new Float32Array(128)];
    const input = Float32Array.from({length: 128}, (_, j) => .2 * Math.sin(2 * Math.PI * 440 * (i + j) / sampleRate));
    host.node.process([[input, input]], [block], {});
    for (let channel = 0; channel < 2; channel++) out[channel].set(block[channel].subarray(0, Math.min(128, out[0].length - i)), i);
  }
  manifest.push({...save('stop-flush', {channels: out, sampleRate, startAt: .25, duration: 3, latency: host.call('latency')}, []), stopAt});
  const rejected = save('rejected-buffered-default', await render({channels: [sine(440)], sampleRate, inputMode: 'buffered', blockMs: 120}), [432, 432]);
  fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({host: 'Node VM minimal AudioWorklet host; real vendored WebAssembly DSP', sampleRate, cases: manifest, rejected}, null, 2) + '\n');
  console.log(JSON.stringify({directory, cases: manifest.length, scope: 'Numerical DSP only; not a real browser or acoustic test'}));
})().catch(error => {console.error(error); process.exitCode = 1;});
