/** Real React components in jsdom; relay and conversation engines are explicit doubles. */
import { after, afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://mukti.test' })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator })
const { render, fireEvent, cleanup, act } = await import('@testing-library/react')
afterEach(cleanup)
after(() => dom.window.close())

function loadComponent(name, mocks) {
  const filename = fileURLToPath(new URL('../../src/components/cercles/room/' + name + '.tsx', import.meta.url))
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const exports = {}
  const imports = { react: React, 'react/jsx-runtime': jsxRuntime, ...mocks }
  vm.runInNewContext(code, { exports, require: (key) => {
    if (!(key in imports)) throw new Error('Unexpected UI dependency: ' + key)
    return imports[key]
  } }, { filename })
  return exports.default
}
function fixture() {
  const attempts = [], micChanges = []
  const Panel = loadComponent('CircleListeningPanel', {
    '@/lib/circle-listener': { createCircleListener: (options) => {
      const record = { options, starts: 0, stops: 0, resumes: 0, volumes: [] }
      const handle = {
        start: async () => { record.starts++; options.onState('connecting') },
        stop: () => { record.stops++; options.onState('stopped') },
        setVolume: (volume) => record.volumes.push(volume),
        resumeAudio: async () => { record.resumes++; options.onState('connected') },
      }
      attempts.push(record)
      return handle
    } },
  })
  function MockConversation() { return React.createElement('span', { 'data-testid': 'conversation-engine' }) }
  function MockIcon() { return React.createElement('span') }
  const Controls = loadComponent('CircleAudioControls', {
    'lucide-react': { Mic: MockIcon, MicOff: MockIcon },
    './CircleListeningPanel': { default: Panel },
    './AudioSFUEngine': { default: MockConversation },
    './AudioMeshEngine': { default: MockConversation },
  })
  const props = { circleId: 'circle-test', myUserId: 'user-test', hasJoined: true, useSFU: true, micMuted: true,
    onMicMuted: (value) => micChanges.push(value), onSpeakingChange: () => {}, onError: () => {} }
  return { Panel, Controls, props, attempts, micChanges }
}

test('listener panel does not connect on mount, including React StrictMode', () => {
  const f = fixture()
  const view = render(React.createElement(React.StrictMode, null, React.createElement(f.Panel, { circleId: 'circle-test' })))
  assert.equal(f.attempts.length, 0)
  fireEvent.click(view.getByRole('button', { name: 'Écouter sans microphone' }))
  assert.equal(f.attempts.length, 1)
  assert.equal(f.attempts[0].starts, 1)
  assert.equal(f.attempts[0].options.volume, 0.25)
})
test('local volume and Stop reach the current listener', () => {
  const f = fixture()
  const view = render(React.createElement(f.Panel, { circleId: 'circle-test' }))
  fireEvent.click(view.getByRole('button', { name: 'Écouter sans microphone' }))
  fireEvent.change(view.getByRole('slider', { name: 'Volume local de l’écoute' }), { target: { value: '0' } })
  assert.deepEqual(f.attempts[0].volumes, [0])
  fireEvent.click(view.getByRole('button', { name: 'Arrêter l’écoute' }))
  assert.equal(f.attempts[0].stops, 1)
  assert.ok(view.getByText('Aucune écoute en cours.'))
})
test('late callbacks from a stopped attempt cannot alter a newly started attempt', () => {
  const f = fixture()
  const view = render(React.createElement(f.Panel, { circleId: 'circle-test' }))
  fireEvent.click(view.getByRole('button', { name: 'Écouter sans microphone' }))
  fireEvent.click(view.getByRole('button', { name: 'Arrêter l’écoute' }))
  fireEvent.click(view.getByRole('button', { name: 'Écouter sans microphone' }))
  act(() => { f.attempts[0].options.onState('connected'); f.attempts[0].options.onError('obsolete') })
  assert.equal(view.queryByText('obsolete'), null)
  assert.ok(view.getByText('Connexion au relais audio…'))
  assert.equal(f.attempts.length, 2)
})
test('unmount releases the listener and ignores its delayed callbacks', () => {
  const f = fixture()
  const view = render(React.createElement(f.Panel, { circleId: 'circle-test' }))
  fireEvent.click(view.getByRole('button', { name: 'Écouter sans microphone' }))
  view.unmount()
  assert.equal(f.attempts[0].stops, 1)
  act(() => { f.attempts[0].options.onState('connected'); f.attempts[0].options.onError('late') })
  assert.equal(document.body.textContent, '')
})
test('autoplay recovery requires an explicit button click', () => {
  const f = fixture()
  const view = render(React.createElement(f.Panel, { circleId: 'circle-test' }))
  fireEvent.click(view.getByRole('button', { name: 'Écouter sans microphone' }))
  act(() => f.attempts[0].options.onState('playback-blocked'))
  assert.equal(f.attempts[0].resumes, 0)
  fireEvent.click(view.getByRole('button', { name: 'Autoriser le son sur cet appareil' }))
  assert.equal(f.attempts[0].resumes, 1)
})
test('a failed attempt allows explicit retry without an automatic request loop', () => {
  const f = fixture()
  const view = render(React.createElement(f.Panel, { circleId: 'circle-test' }))
  fireEvent.click(view.getByRole('button', { name: 'Écouter sans microphone' }))
  act(() => { f.attempts[0].options.onState('error'); f.attempts[0].options.onError('refused') })
  assert.equal(f.attempts.length, 1)
  assert.ok(view.getByRole('alert'))
  fireEvent.click(view.getByRole('button', { name: 'Écouter sans microphone' }))
  assert.equal(f.attempts.length, 2)
  assert.equal(view.queryByRole('alert'), null)
})
test('switching to conversation stops the listener and starts with the microphone muted', () => {
  const f = fixture()
  const view = render(React.createElement(f.Controls, f.props))
  assert.equal(view.queryByTestId('conversation-engine'), null)
  assert.equal(f.attempts.length, 0)
  fireEvent.click(view.getByRole('button', { name: 'Écouter sans microphone' }))
  fireEvent.click(view.getByRole('button', { name: /Rejoindre la conversation/ }))
  assert.equal(f.attempts[0].stops, 1)
  assert.deepEqual(f.micChanges, [true])
  assert.ok(view.getByTestId('conversation-engine'))
})
test('unadmitted and mesh users are never silently put into a listener or microphone session', () => {
  const f = fixture()
  const view = render(React.createElement(f.Controls, { ...f.props, hasJoined: false }))
  assert.equal(view.queryByRole('button'), null)
  view.rerender(React.createElement(f.Controls, { ...f.props, useSFU: false }))
  assert.equal(view.queryByRole('button', { name: 'Écouter sans microphone' }), null)
  assert.equal(view.queryByTestId('conversation-engine'), null)
  assert.equal(f.attempts.length, 0)
})
