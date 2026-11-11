/* Application lifecycle tests using explicit Web Audio test doubles.
 * These are not browser playback, acoustic or device-compatibility tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {HarmonieEngine, semitonesFor, melodyFrequency, validateConfiguration} from '../harmonie-engine.mjs';

class Parameter {
  constructor(value = 0) { this.value = value; this.events = []; }
  setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); }
  linearRampToValueAtTime(value, time) { this.events.push(['linear', value, time]); }
  exponentialRampToValueAtTime(value, time) { this.events.push(['exponential', value, time]); }
  cancelScheduledValues(time) { this.events.push(['cancel', time]); }
  cancelAndHoldAtTime(time) { this.events.push(['hold', time]); }
}
class Node {
  connect(next) { this.destination = next; return next; }
  disconnect() { this.disconnected = true; }
}
class Context {
  constructor() {
    this.currentTime = 0; this.state = 'suspended'; this.sampleRate = 48000;
    this.destination = {}; this.oscillators = []; this.gains = []; this.closed = 0;
  }
  createGain() { const node = new Node(); node.gain = new Parameter(); this.gains.push(node); return node; }
  createOscillator() {
    const node = new Node(); node.frequency = new Parameter();
    node.start = time => { node.startTime = time; };
    node.stop = time => { node.stopTime = time ?? this.currentTime; };
    this.oscillators.push(node); return node;
  }
  resume() { this.state = 'running'; this.onstatechange?.(); return Promise.resolve(); }
  suspend() { this.state = 'suspended'; this.onstatechange?.(); return Promise.resolve(); }
  close() { this.closed++; this.state = 'closed'; this.onstatechange?.(); return Promise.resolve(); }
}
const config = extra => ({mode: 'tone', volume: .12, duration: 60, toneHz: 432, overlayLevel: .2, overlay: false, ...extra});
const originalContext = globalThis.AudioContext;
test.after(() => { globalThis.AudioContext = originalContext; });

test('exact requested ratio, input validation, already-432 and melody A4', () => {
  assert.equal(semitonesFor(432), 0);
  assert.ok(Math.abs(2 ** (semitonesFor(440) / 12) - 432 / 440) < 1e-15);
  assert.equal(melodyFrequency(69), 432);
  assert.equal(melodyFrequency(81), 864);
  for (const value of [NaN, Infinity, 0, -440, '440', 481]) assert.throws(() => semitonesFor(value));
  for (const invalid of [{volume: .26}, {volume: -1}, {toneHz: 20}, {toneHz: 2001}, {duration: 0}, {overlayLevel: .41}]) {
    assert.throws(() => validateConfiguration(config(invalid)));
  }
});

test('explicit pause stays muted when changing volume and resumes only on request', async () => {
  globalThis.AudioContext = Context;
  const engine = new HarmonieEngine();
  try {
    await engine.start(config());
    const session = engine.session;
    assert.equal(engine.state, 'playing');
    assert.equal(session.context.oscillators[0].frequency.value, 432);
    await engine.pause();
    assert.equal(engine.state, 'paused');
    assert.equal(session.context.state, 'suspended');
    const eventCount = session.gain.gain.events.length;
    engine.setVolume(.2);
    assert.equal(session.gain.gain.events.length, eventCount);
    await engine.resume();
    assert.equal(engine.state, 'playing');
    assert.equal(session.config.volume, .2);
    await engine.stop();
    assert.equal(session.context.state, 'closed');
    assert.equal(session.context.closed, 1);
    assert.equal(engine.session, null);
  } finally { await engine.stop(); }
});

test('OS interruption closes the session rather than silently resuming', async () => {
  globalThis.AudioContext = Context;
  const engine = new HarmonieEngine();
  await engine.start(config());
  const session = engine.session;
  session.context.state = 'interrupted';
  session.context.onstatechange();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(engine.state, 'stopped');
  assert.equal(engine.session, null);
  assert.equal(session.context.state, 'closed');
  assert.equal(session.sources.size, 0);
});

test('stop during an asynchronous start cannot resurrect playback', async () => {
  let resume;
  class PendingContext extends Context {
    resume() { return new Promise(resolve => { resume = resolve; }); }
  }
  globalThis.AudioContext = PendingContext;
  const engine = new HarmonieEngine();
  const pending = engine.start(config());
  const session = engine.session;
  await engine.stop();
  resume();
  await pending;
  assert.equal(engine.state, 'stopped');
  assert.equal(engine.session, null);
  assert.equal(session.context.oscillators.length, 0);
  assert.equal(session.context.closed, 1);
});

test('melody scheduler skips missed notes without stacking oscillators', () => {
  const originalInterval = globalThis.setInterval;
  let tick;
  globalThis.setInterval = callback => { tick = callback; return 1; };
  try {
    const engine = new HarmonieEngine();
    const context = new Context();
    const session = {context, startAt: .04, duration: 60, sources: new Set(), gain: context.createGain()};
    engine.session = session;
    engine.startMelody(session);
    const before = context.oscillators.length;
    context.currentTime = 20;
    tick();
    const added = context.oscillators.slice(before);
    assert.ok(added.length <= 2, `A stalled timer created ${added.length} simultaneous notes`);
    assert.ok(added.every(node => node.startTime >= 20));
    context.currentTime = 65;
    const endedCount = context.oscillators.length;
    tick();
    assert.equal(context.oscillators.length, endedCount);
  } finally { globalThis.setInterval = originalInterval; }
});

test('overlay is a separate continuous 432 Hz oscillator with finite stop', async () => {
  globalThis.AudioContext = Context;
  const engine = new HarmonieEngine();
  try {
    await engine.start(config({mode: 'melody', overlay: true}));
    const session = engine.session;
    const continuous = session.context.oscillators.filter(node => node.stopTime === session.startAt + 60);
    assert.equal(continuous.length, 1);
    assert.equal(continuous[0].frequency.value, 432);
    assert.ok(session.context.oscillators.length >= 2);
    assert.ok(session.gain.gain.events.some(event => event[0] === 'linear' && event[1] === 0 && event[2] === session.startAt + 60));
  } finally { await engine.stop(); }
});
