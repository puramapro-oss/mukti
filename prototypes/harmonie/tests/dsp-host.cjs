/* The real, vendored WASM processor under a minimal worklet host.
 * This validates the numerical DSP. It does not validate a real browser.
 */
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const vendor = path.resolve(__dirname, '../vendor/SignalsmithStretch-1.3.2.js');

async function createProcessor(sampleRate = 48000) {
  const messages = [];
  let Processor;
  const sandbox = {
    sampleRate,
    currentTime: 0,
    console,
    crypto: webcrypto,
    performance,
    WebAssembly,
    setTimeout,
    clearTimeout,
    atob,
    btoa,
    TextDecoder,
    TextEncoder,
    AudioWorkletProcessor: class {
      constructor() {
        this.port = { postMessage: message => messages.push(message), onmessage: null };
      }
    },
    registerProcessor: (_, constructor) => { Processor = constructor; },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(vendor, 'utf8'), sandbox, {filename: vendor});
  const node = new Processor({numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2]});
  const deadline = performance.now() + 5000;
  while (!node.wasmReady && performance.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  if (!node.wasmReady) throw new Error('WASM initialization timeout');
  let id = 0;
  const call = (method, ...args) => {
    const messageId = id++;
    node.port.onmessage({data: [messageId, method, ...args]});
    const reply = messages.find(message => message[0] === messageId);
    if (!reply) throw new Error('No reply: ' + method);
    return reply[1];
  };
  return {node, sandbox, call, messages};
}

async function render({channels, sourceHz = 440, targetHz = 432, sampleRate = 48000, startAt = 0.25, extraSeconds = 0.3, inputMode = 'live', blockMs = 320}) {
  const h = await createProcessor(sampleRate);
  const duration = channels[0].length / sampleRate;
  h.call('configure', {blockMs, intervalMs: blockMs / 4});
  if (inputMode === 'buffered') h.call('addBuffers', channels);
  const latency = h.call('latency');
  const outputStartAt = inputMode === 'live' ? startAt + latency : startAt;
  h.call('schedule', {
    input: 0, output: inputMode === 'live' ? 0 : startAt,
    active: true, rate: 1,
    semitones: 12 * Math.log2(targetHz / sourceHz),
    tonalityHz: 0, formantCompensation: false,
  });
  const sampleCount = Math.ceil((outputStartAt + duration + extraSeconds) * sampleRate);
  const outputs = [new Float32Array(sampleCount), new Float32Array(sampleCount)];
  for (let frame = 0; frame < sampleCount; frame += 128) {
    h.sandbox.currentTime = frame / sampleRate;
    const block = [new Float32Array(128), new Float32Array(128)];
    const inputs = inputMode === 'live' ? channels.map(channel => {
      const input = new Float32Array(128);
      for (let i = 0; i < 128; i++) {
        const index = frame + i - Math.round(startAt * sampleRate);
        if (index >= 0 && index < channel.length) input[i] = channel[index];
      }
      return input;
    }) : [];
    h.node.process([inputs], [block], {});
    for (let channel = 0; channel < 2; channel++) {
      outputs[channel].set(block[channel].subarray(0, Math.min(128, sampleCount - frame)), frame);
    }
  }
  return {channels: outputs, sampleRate, latency, duration, startAt: outputStartAt, inputMode, blockMs};
}

module.exports = {createProcessor, render};
