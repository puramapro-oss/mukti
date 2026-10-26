/** Real upstream OTS parser, serializer and hash operations; HTTP explicitly mocked.
 * No live calendars, money, documents, production database or device outputs.
 */
import { test, beforeEach, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import * as ots from '@opentimestamps/typescript-opentimestamps'

const temp = mkdtempSync(path.join(process.cwd(), '.mukti-ots-tests-'))
for (const name of ['opentimestamps-network', 'opentimestamps']) {
  const source = readFileSync(path.join(process.cwd(), 'src/lib', name + '.ts'), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  writeFileSync(path.join(temp, name + '.mjs'), output.replace("'./opentimestamps-network'", "'./opentimestamps-network.mjs'"))
}
const api = await import(pathToFileURL(path.join(temp, 'opentimestamps.mjs')).href)
const net = await import(pathToFileURL(path.join(temp, 'opentimestamps-network.mjs')).href)
after(() => { mock.restoreAll(); rmSync(temp, { recursive: true, force: true }) })
beforeEach(() => mock.restoreAll())
const HASH = createHash('sha256').update('MUKTI synthetic interoperability fixture; no personal data').digest('hex')
const HEIGHT = 800000
const BLOCK = 'ab'.repeat(32)
const TIME = 1690000000
const origin = net.OTS_CALENDARS[0]
const bodyResponse = body => new Response(body, { headers: { 'Content-Type': 'application/octet-stream' } })
const textResponse = text => new Response(text)
const jsonResponse = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
function stampTree(leaf, hash = HASH, transform) {
  const tree = ots.newTree(); tree.leaves.add(leaf)
  const timestamp = { version: 1, fileHash: { algorithm: 'sha256', value: new Uint8Array(Buffer.from(hash, 'hex')) }, tree }
  if (transform) transform(timestamp)
  return ots.write(timestamp)
}
const pending = () => stampTree({ type: 'pending', url: new URL(origin) }).slice(65)
const bitcoin = () => stampTree({ type: 'bitcoin', height: HEIGHT }).slice(65)
function proof(leaf, transform) { return Buffer.from(stampTree(leaf, HASH, transform)).toString('base64') }
function blockJson(root = Buffer.from(HASH, 'hex').reverse().toString('hex'), changes = {}) {
  return { id: BLOCK, height: HEIGHT, merkle_root: root, timestamp: TIME, ...changes }
}
function mockBlocks(data = blockJson()) {
  return mock.method(globalThis, 'fetch', async url => {
    const text = String(url)
    if (text === `https://blockstream.info/api/block-height/${HEIGHT}`) return textResponse(BLOCK)
    if (text === `https://blockstream.info/api/block/${BLOCK}`) return jsonResponse(data)
    throw new Error('Unexpected network destination: ' + text)
  })
}

test('sha256 helper retains its public string and Buffer contract', () => {
  assert.equal(api.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  assert.equal(api.sha256Hex(Buffer.from('abc')), api.sha256Hex('abc'))
})
for (const invalid of ['', 'ab', 'x'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), null, 12]) {
  test(`stamp rejects invalid digest ${JSON.stringify(invalid)} before network access`, async () => {
    const call = mock.method(globalThis, 'fetch', async () => { throw new Error('must not call') })
    assert.equal(await api.stampHash(invalid), null); assert.equal(call.mock.callCount(), 0)
  })
}
test('stamp preserves standard base64 .ots storage, digest and private nonce', async () => {
  const submitted = []
  const call = mock.method(globalThis, 'fetch', async (url, init) => {
    assert.ok(net.OTS_CALENDARS.some(host => String(url) === host + '/digest'))
    assert.equal(init.method, 'POST'); assert.equal(init.redirect, 'error')
    submitted.push(Buffer.from(init.body).toString('hex'))
    return bodyResponse(pending())
  })
  const encoded = await api.stampHash(HASH.toUpperCase())
  assert.equal(typeof encoded, 'string')
  const parsed = ots.read(new Uint8Array(Buffer.from(encoded, 'base64')))
  assert.equal(Buffer.from(parsed.fileHash.value).toString('hex'), HASH)
  assert.equal(parsed.fileHash.algorithm, 'sha256')
  assert.equal(call.mock.callCount(), 3); assert.equal(new Set(submitted).size, 1)
  assert.notEqual(submitted[0], HASH)
  const [append, hashed] = parsed.tree.edges.entries()[0]
  assert.equal(append.type, 'append'); assert.equal(append.operand.length, 16)
  assert.equal(hashed.edges.keys()[0].type, 'sha256')
  assert.equal(createHash('sha256').update(Buffer.from(HASH, 'hex')).update(append.operand).digest('hex'), submitted[0])
  assert.equal(Buffer.from(ots.write(parsed)).toString('base64'), encoded)
})
test('one successful calendar is retained despite other provider failures', async () => {
  mock.method(globalThis, 'fetch', async url => String(url).startsWith(origin) ? bodyResponse(pending()) : new Response('', { status: 503 }))
  assert.equal(typeof await api.stampHash(HASH), 'string')
})
test('no proof is fabricated when every calendar fails', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }))
  assert.equal(await api.stampHash(HASH), null)
})
test('malformed calendar bodies are not accepted as timestamps', async () => {
  mock.method(globalThis, 'fetch', async () => textResponse('not a timestamp'))
  assert.equal(await api.stampHash(HASH), null)
})
for (const invalid of ['', '====', 'not-base64!', 'YQ=', 'A'.repeat(90000), null, 123]) {
  test(`proof input validation ${typeof invalid}:${String(invalid).slice(0, 12)}`, async () => {
    const call = mock.method(globalThis, 'fetch', async () => { throw new Error('must not call') })
    assert.equal(await api.verifyProof(invalid), null); assert.equal(call.mock.callCount(), 0)
  })
}
test('a legacy v1 .ots Bitcoin proof verifies without changing its stored format', async () => {
  const oldV1 = Buffer.concat([
    Buffer.from('004f70656e54696d657374616d7073000050726f6f6600bf89e2e884e892940108', 'hex'),
    Buffer.from(HASH, 'hex'),
    // v1 Bitcoin attestation: tag, varbytes payload, height 800000 (LEB128).
    Buffer.from('000588960d73d719010380ea30', 'hex'),
  ]).toString('base64')
  assert.equal(oldV1, proof({ type: 'bitcoin', height: HEIGHT }))
  mockBlocks(); assert.equal(await api.verifyProof(oldV1, HASH), TIME)
})
test('hash binding refuses a valid proof for another document before any request', async () => {
  const call = mockBlocks()
  assert.equal(await api.verifyProof(proof({ type: 'bitcoin', height: HEIGHT }), '01'.repeat(32)), null)
  assert.equal(call.mock.callCount(), 0)
})
for (const changes of [
  { merkle_root: '00'.repeat(32) }, { merkle_root: 'bad' }, { id: '00'.repeat(32) },
  { height: HEIGHT + 1 }, { timestamp: -1 }, { timestamp: '1690000000' }, { timestamp: 999999999999 },
]) {
  test('inconsistent block response is not a confirmation: ' + JSON.stringify(changes), async () => {
    mockBlocks(blockJson(undefined, changes))
    assert.equal(await api.verifyProof(proof({ type: 'bitcoin', height: HEIGHT })), null)
  })
}
test('a pending proof is upgraded through an allowlisted calendar then actually verified', async () => {
  mock.method(globalThis, 'fetch', async url => {
    if (String(url) === origin + '/timestamp/' + HASH) return bodyResponse(bitcoin())
    if (String(url).includes('/block-height/')) return textResponse(BLOCK)
    if (String(url).endsWith('/block/' + BLOCK)) return jsonResponse(blockJson())
    throw new Error('Unexpected destination')
  })
  assert.equal(await api.verifyProof(proof({ type: 'pending', url: new URL(origin) }), HASH), TIME)
})
test('a still-pending proof is never reported as Bitcoin-confirmed', async () => {
  mock.method(globalThis, 'fetch', async () => bodyResponse(pending()))
  assert.equal(await api.verifyProof(proof({ type: 'pending', url: new URL(origin) })), null)
})
for (const url of ['http://127.0.0.1', 'https://example.com', 'https://alice.btc.calendar.opentimestamps.org.evil.test', origin + '/unapproved']) {
  test('embedded proof URL cannot trigger SSRF: ' + url, async () => {
    const call = mock.method(globalThis, 'fetch', async () => { throw new Error('must not call') })
    assert.equal(await api.verifyProof(proof({ type: 'pending', url: new URL(url) })), null)
    assert.equal(call.mock.callCount(), 0)
  })
}
test('exponential proof operations are rejected before evaluation or requests', async () => {
  const call = mockBlocks()
  const encoded = proof({ type: 'bitcoin', height: HEIGHT }, stamp => {
    for (let i = 0; i < 10; i++) { const root = ots.newTree(); root.edges.add({ type: 'hexlify' }, stamp.tree); stamp.tree = root }
  })
  assert.equal(await api.verifyProof(encoded), null); assert.equal(call.mock.callCount(), 0)
})
test('timestamp formatting does not throw on invalid numeric values', () => {
  for (const value of [null, NaN, Infinity, -1, 0, 1e16]) assert.match(api.formatBlockchainTimestamp(value), /En attente/)
  assert.match(api.formatBlockchainTimestamp(TIME), /Bitcoin/)
})
test('HTTP deadline cancels even a transport that ignores its AbortSignal', async () => {
  let signal
  mock.method(globalThis, 'fetch', async (_url, init) => { signal = init.signal; return new Promise(() => {}) })
  await assert.rejects(net.requestOtsBytes(new URL(origin + '/digest'), new Uint8Array(32), 20), /timed out/)
  assert.equal(signal.aborted, true)
})
test('HTTP deadline also covers a stalled streaming response body', async () => {
  let cancelled = false
  mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({ cancel() { cancelled = true } })))
  await assert.rejects(net.requestOtsBytes(new URL(origin + '/digest'), new Uint8Array(32), 20), /timed out/)
  assert.equal(cancelled, true)
})
test('oversized streaming bodies are cancelled before parsing', async () => {
  let cancelled = false
  mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(100)); }, cancel() { cancelled = true },
  })))
  await assert.rejects(net.requestOtsBytes(new URL(origin + '/digest'), new Uint8Array(32), 100, 64), /too large/)
  assert.equal(cancelled, true)
})
for (const url of [origin + '/digest?x=1', 'https://user:pass@alice.btc.calendar.opentimestamps.org/digest', 'http://alice.btc.calendar.opentimestamps.org/digest', 'https://127.0.0.1/digest']) {
  test('network boundary rejects noncanonical destination: ' + url, async () => {
    const call = mockBlocks()
    await assert.rejects(net.requestOtsBytes(new URL(url), new Uint8Array(32)), /Unapproved/)
    assert.equal(call.mock.callCount(), 0)
  })
}
test('redirects and oversized declared lengths are refused', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('x', { status: 302, headers: { Location: 'https://127.0.0.1' } }))
  await assert.rejects(net.requestOtsBytes(new URL(origin + '/digest'), new Uint8Array(32)))
  mock.restoreAll()
  mock.method(globalThis, 'fetch', async () => new Response('x', { headers: { 'Content-Length': '999999999' } }))
  await assert.rejects(net.requestOtsBytes(new URL(origin + '/digest'), new Uint8Array(32)), /too large/)
})
