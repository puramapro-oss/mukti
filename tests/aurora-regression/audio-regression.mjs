import { test } from 'node:test'
import assert from 'node:assert/strict'
import { audioFixture } from './runtime-fixtures.mjs'

test('audio: silent preparation, then normal explicit playback', async () => {
  const f = audioFixture(); const audio = f.create(); await audio.prepare()
  assert.equal(f.context().gains[0].gain.value, 0)
  await audio.start(); audio.setPhase('inspire')
  assert.ok(f.context().gains[0].gain.value > 0)
  audio.dispose()
})

test('audio: unsupported browser must report unavailable instead of pretending to start', async () => {
  const audio = audioFixture({ support: false }).create()
  await assert.rejects(audio.prepare(), /Audio|audio/)
  await assert.rejects(audio.start(), /Audio|audio/)
})

test('audio: stop clears all persistent channel gains, not just master', async () => {
  const f = audioFixture(); const audio = f.create(); await audio.start(); audio.setPhase('expire'); audio.stop()
  for (const gain of f.context().gains.slice(0, 4)) assert.equal(gain.gain.value, 0)
  audio.dispose()
})

test('audio: restart remains silent until a new phase is selected', async () => {
  const f = audioFixture(); const audio = f.create(); await audio.start(); audio.setPhase('expire'); audio.stop()
  for (const g of f.context().gains) g.gain.events.length = 0
  await audio.start()
  for (const g of f.context().gains.slice(1, 4)) {
    const initialSet = g.gain.events.find(e => e[0] === 'set')
    assert.ok(initialSet); assert.equal(initialSet[1], 0)
  }
  audio.dispose()
})

test('audio: unavailable speech constructor cannot break session execution', async () => {
  const f = audioFixture({ utterance: false }); const audio = f.create(); await audio.start(); audio.setVoiceGuidance(true)
  assert.doesNotThrow(() => audio.speakPhaseCue('Respire naturellement.')); audio.dispose()
})

test('audio: failure of optional speech cannot prevent stop and disposal', async () => {
  const f = audioFixture({ voiceThrows: true }); const audio = f.create(); await audio.start()
  assert.doesNotThrow(() => audio.stop())
  assert.doesNotThrow(() => audio.dispose())
  assert.equal(f.context().closed, 1)
})

test('audio: cleanup still closes the context when a source stop throws', async () => {
  const f = audioFixture(); const audio = f.create(); await audio.start()
  f.context().sources[0].throwOnStop = true
  assert.doesNotThrow(() => audio.dispose())
  assert.equal(f.context().closed, 1)
  for (const n of f.context().sources.slice(1)) assert.ok(n.stops >= 1)
})

test('audio: disposal disconnects sources and is idempotent', async () => {
  const f = audioFixture(); const audio = f.create(); await audio.start(); audio.dispose(); audio.dispose()
  assert.equal(f.context().closed, 1)
  for (const n of f.context().sources) assert.ok(n.disconnections >= 1)
})

test('audio: rejected resume never enables the master gain', async () => {
  const f = audioFixture({ rejectResume: true }); const audio = f.create()
  await assert.rejects(audio.start(), /resume rejected/)
  assert.equal(f.context().gains[0].gain.value, 0); audio.dispose()
})

for (const gain of [NaN, Infinity, -Infinity, -2, -0.1, 0, 0.1, 0.35, 1, 2, 100]) {
  test(`audio: numerical gain validation ${String(gain)}`, async () => {
    const f = audioFixture(); const audio = f.create({ masterGain: gain }); await audio.start(); audio.setPhase('inspire')
    const actual = f.context().gains[0].gain.value
    assert.ok(Number.isFinite(actual) && actual >= 0 && actual <= 1)
    audio.dispose()
  })
}
for (const freq of [NaN, Infinity, -Infinity, -432, 0, 1, 96, 432, 1000, 23999, 24000, 96000]) {
  test(`audio: invalid carrier frequency fallback ${String(freq)}`, async () => {
    const f = audioFixture(); const audio = f.create({ nappeFreqHz: freq, subFreqHz: freq })
    for (const n of f.context().sources.slice(0, 2)) assert.ok(Number.isFinite(n.frequency.value) && n.frequency.value > 0 && n.frequency.value < 24000)
    audio.dispose()
  })
}

test('audio: 1000 deterministic lifecycle actions preserve silence after stop/disable', async () => {
  const f = audioFixture(); const audio = f.create(); let seed = 0x5eed; let disabled = false; let stopped = true
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % 8 }
  for (let i = 0; i < 1000; i++) {
    switch (next()) {
      case 0: await audio.start(); stopped = false; break
      case 1: audio.stop(); stopped = true; break
      case 2: audio.setEnabled(false); disabled = true; break
      case 3: audio.setEnabled(true); disabled = false; break
      case 4: audio.setPhase('inspire'); break
      case 5: audio.setPhase('expire'); break
      case 6: audio.setVoiceGuidance(true); audio.speakPhaseCue('Exemple'); break
      case 7: audio.setVoiceGuidance(false); break
    }
    if (disabled || stopped) assert.equal(f.context().gains[0].gain.value, 0)
  }
  audio.dispose()
})


// Regression cases for silence and resource release. No physical outputs.
test('audio: zero or clamped-negative master gain never queues voice guidance', async () => {
  for (const gain of [0, -1]) {
    const f = audioFixture(); const audio = f.create({ masterGain: gain })
    try {
      await audio.start(); audio.setVoiceGuidance(true); audio.speakPhaseCue('Exemple')
      assert.equal(f.speech.cues.length, 0)
    } finally { audio.dispose() }
  }
})

test('audio: voice remains opt-in and still works when explicitly enabled at a nonzero gain', async () => {
  const f = audioFixture(); const audio = f.create()
  try {
    await audio.start(); audio.speakPhaseCue('Muet')
    assert.equal(f.speech.cues.length, 0)
    audio.setVoiceGuidance(true); audio.speakPhaseCue('Exemple')
    assert.equal(f.speech.cues.length, 1)
    audio.setVoiceGuidance(false); audio.speakPhaseCue('Muet')
    assert.equal(f.speech.cues.length, 1)
  } finally { audio.dispose() }
})

test('audio: muting stops and releases every pending transient before unmuting', async () => {
  const f = audioFixture(); const audio = f.create()
  try {
    await audio.start(); audio.setPhase('hold')
    const transient = f.context().sources.at(-1), gain = f.context().gains.at(-1)
    assert.equal(transient.stops, 1) // scheduled natural end, not cancellation
    audio.setEnabled(false)
    assert.equal(transient.stops, 2)
    assert.ok(transient.disconnections >= 1)
    assert.ok(gain.disconnections >= 1)
    assert.equal(gain.gain.value, 0)
    assert.equal(transient.onended, null)
    audio.setPhase('idle'); audio.setEnabled(true)
    assert.equal(f.context().sources.length, 4)
  } finally { audio.dispose() }
})

test('audio: transient cleanup continues when stop or disconnect throws', async () => {
  const f = audioFixture(); const audio = f.create()
  try {
    await audio.start(); audio.setPhase('hold')
    const transient = f.context().sources.at(-1), gain = f.context().gains.at(-1)
    transient.throwOnStop = true; transient.throwOnDisconnect = true
    assert.doesNotThrow(() => audio.setEnabled(false))
    assert.ok(transient.disconnections >= 1)
    assert.ok(gain.disconnections >= 1)
    assert.equal(gain.gain.value, 0)
    assert.equal(f.context().gains[0].gain.value, 0)
  } finally { audio.dispose() }
})

test('audio: naturally ended transient releases its gain despite a failed source disconnect', async () => {
  const f = audioFixture(); const audio = f.create()
  try {
    await audio.start(); audio.setPhase('hold')
    const transient = f.context().sources.at(-1), gain = f.context().gains.at(-1)
    transient.throwOnDisconnect = true
    const ended = transient.onended
    assert.doesNotThrow(() => ended())
    assert.equal(gain.disconnections, 1)
    assert.equal(transient.onended, null)
  } finally { audio.dispose() }
})

test('audio: repeated enable command does not generate additional hold tones', async () => {
  const f = audioFixture(); const audio = f.create()
  try {
    await audio.start(); audio.setPhase('hold')
    const count = f.context().sources.length
    audio.setEnabled(true); audio.setEnabled(true)
    assert.equal(f.context().sources.length, count)
  } finally { audio.dispose() }
})

test('audio: mute still silences master and voice when a layer cannot cancel automation', async () => {
  const f = audioFixture(); const audio = f.create()
  try {
    await audio.start(); audio.setPhase('expire'); audio.setVoiceGuidance(true)
    audio.speakPhaseCue('Exemple')
    const cancelled = f.speech.cancellations
    f.context().gains[1].gain.throwOnCancel = true
    assert.doesNotThrow(() => audio.setEnabled(false))
    assert.equal(f.context().gains[0].gain.value, 0)
    for (const g of f.context().gains.slice(1,4)) assert.equal(g.gain.value, 0)
    assert.ok(f.speech.cancellations > cancelled)
  } finally { audio.dispose() }
})

test('audio: stop resets a gain even if cancelScheduledValues fails on that gain', async () => {
  const f = audioFixture(); const audio = f.create()
  try {
    await audio.start(); audio.setPhase('expire')
    for (const g of f.context().gains.slice(0,4)) g.gain.throwOnCancel = true
    assert.doesNotThrow(() => audio.stop())
    for (const g of f.context().gains.slice(0,4)) assert.equal(g.gain.value, 0)
  } finally { audio.dispose() }
})

test('audio: idle phase cancels a pending hold transient', async () => {
  const f = audioFixture(); const audio = f.create()
  try {
    await audio.start(); audio.setPhase('hold')
    const transient = f.context().sources.at(-1)
    audio.setPhase('idle')
    assert.ok(transient.stops >= 2)
    assert.ok(transient.disconnections >= 1)
  } finally { audio.dispose() }
})

test('audio: zero master gain does not allocate silent hold transients', async () => {
  const f = audioFixture(); const audio = f.create({ masterGain: 0 })
  try {
    await audio.start(); audio.setPhase('hold')
    assert.equal(f.context().sources.length, 3)
  } finally { audio.dispose() }
})

test('audio: phase updates before an explicit start cannot raise channel levels', () => {
  const f = audioFixture(); const audio = f.create()
  try {
    for (const phase of ['inspire','expire','hold','idle']) audio.setPhase(phase)
    for (const g of f.context().gains) assert.equal(g.gain.value, 0)
    assert.equal(f.context().sources.length, 3)
  } finally { audio.dispose() }
})

test('audio: pending asynchronous start cannot undo a later stop', async () => {
  const f = audioFixture(); const audio = f.create()
  let resolve
  f.context().resume = () => new Promise(r => { resolve = r })
  try {
    const pending = audio.start(); audio.stop(); resolve(); await pending
    audio.setPhase('inspire')
    for (const g of f.context().gains) assert.equal(g.gain.value, 0)
  } finally { audio.dispose() }
})

test('audio: 100 mute/unmute cycles release their transient resources', async () => {
  const f = audioFixture(); const audio = f.create()
  try {
    await audio.start()
    for (let i=0;i<100;i++) {
      audio.setPhase('hold')
      const source = f.context().sources.at(-1), gain = f.context().gains.at(-1)
      audio.setEnabled(false)
      assert.ok(source.stops >= 2)
      assert.ok(source.disconnections >= 1)
      assert.ok(gain.disconnections >= 1)
      audio.setPhase('idle'); audio.setEnabled(true)
    }
  } finally { audio.dispose() }
})
