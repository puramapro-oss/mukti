// MUKTI — standard OpenTimestamps proofs; server-only, never a health measurement.
// Keep the existing API and base64 .ots storage format while removing the legacy
// request/web3/bitcore dependency chain. Only hashes, not documents, leave the server.
import { createHash, randomBytes } from 'node:crypto'
import type { Leaf, Timestamp, Tree } from '@opentimestamps/typescript-opentimestamps'
import { allowedOtsCalendar, OTS_CALENDARS, requestOtsBytes } from './opentimestamps-network'

const MAX_PROOF_BYTES = 65536
// Standard .ots v1 detached-file prefix; parsed and written by the upstream library.
const MAGIC = Buffer.from('004f70656e54696d657374616d7073000050726f6f6600bf89e2e884e89294', 'hex')
const HASH = /^[0-9a-f]{64}$/i
const pendingLabel = 'En attente de confirmation Bitcoin…'
type Ots = typeof import('@opentimestamps/typescript-opentimestamps')
const loadOts = () => import('@opentimestamps/typescript-opentimestamps')

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex')
}

/** Bound operations before executing a proof, including exponential hexlify paths. */
function inspectTree(timestamp: Timestamp): Map<Leaf, Tree> {
  const owners = new Map<Leaf, Tree>()
  const queue = [{ tree: timestamp.tree, depth: 0, length: timestamp.fileHash.value.length }]
  let visited = 0
  while (queue.length) {
    const item = queue.pop()!
    if (++visited > 512 || item.depth > 64 || item.length > 4096) throw new Error('Proof complexity exceeded')
    for (const leaf of item.tree.leaves.values()) {
      owners.set(leaf, item.tree)
      if (owners.size > 16) throw new Error('Too many attestations')
    }
    for (const [op, tree] of item.tree.edges.entries()) {
      let length = item.length
      if (op.type === 'append' || op.type === 'prepend') length += op.operand.length
      else if (op.type === 'hexlify') length *= 2
      else if (op.type === 'sha256' || op.type === 'keccak256') length = 32
      else if (op.type === 'sha1' || op.type === 'ripemd160') length = 20
      queue.push({ tree, depth: item.depth + 1, length })
    }
  }
  return owners
}
function readCalendarTree(ots: Ots, digest: Uint8Array, bytes: Uint8Array): Tree {
  if (digest.length !== 32 || !bytes.length || bytes.length > MAX_PROOF_BYTES) throw new Error('Invalid calendar proof')
  const proof = ots.read(new Uint8Array(Buffer.concat([MAGIC, Buffer.from([1, 8]), digest, bytes])))
  const leaves = [...inspectTree(proof).keys()]
  if (!leaves.some(leaf => leaf.type === 'bitcoin' || (leaf.type === 'pending' && allowedOtsCalendar(leaf.url)))) {
    throw new Error('No supported attestation')
  }
  return proof.tree
}

/** Creates a pending proof; a completed request does NOT mean Bitcoin confirmation. */
export async function stampHash(sha256HashHex: string): Promise<string | null> {
  if (typeof sha256HashHex !== 'string' || !HASH.test(sha256HashHex)) return null
  try {
    const ots = await loadOts()
    const original = Buffer.from(sha256HashHex, 'hex')
    const nonce = randomBytes(16)
    const submitted = createHash('sha256').update(original).update(nonce).digest()
    const responses = await Promise.all(OTS_CALENDARS.map(async origin => {
      try {
        return readCalendarTree(ots, submitted, await requestOtsBytes(new URL('/digest', origin), submitted))
      } catch { return null }
    }))
    const successful = responses.filter((tree): tree is Tree => tree !== null)
    if (!successful.length) return null
    const merged = ots.newTree()
    for (const tree of successful) {
      merged.leaves.incorporate(tree.leaves)
      merged.edges.incorporate(tree.edges)
    }
    const hashTree = ots.newTree()
    hashTree.edges.add({ type: 'sha256' }, merged)
    const root = ots.newTree()
    root.edges.add({ type: 'append', operand: nonce }, hashTree)
    const timestamp: Timestamp = { version: 1, fileHash: { algorithm: 'sha256', value: original }, tree: root }
    inspectTree(timestamp)
    const bytes = ots.write(timestamp)
    return bytes.length <= MAX_PROOF_BYTES ? Buffer.from(bytes).toString('base64') : null
  } catch { return null }
}

async function upgradeAllowed(ots: Ots, timestamp: Timestamp): Promise<void> {
  const owners = inspectTree(timestamp)
  // Upstream verify evaluates the exact standard operations to each pending leaf.
  // Unlike unrestricted upgrade(), this callback never follows arbitrary proof URLs.
  await ots.verify(timestamp, { approvedCalendars: async (message, leaf) => {
    if (leaf.type !== 'pending' || !allowedOtsCalendar(leaf.url) || message.length !== 32) return undefined
    const url = new URL('/timestamp/' + Buffer.from(message).toString('hex'), leaf.url)
    const tree = readCalendarTree(ots, message, await requestOtsBytes(url))
    const owner = owners.get(leaf)
    if (owner) {
      owner.leaves.incorporate(tree.leaves)
      owner.edges.incorporate(tree.edges)
    }
    return undefined
  } })
  inspectTree(timestamp)
}

async function blockAtHeight(height: number): Promise<{ root: string; time: number }> {
  if (!Number.isSafeInteger(height) || height < 0 || height > 99999999) throw new Error('Invalid block height')
  const id = Buffer.from(await requestOtsBytes(new URL(`https://blockstream.info/api/block-height/${height}`), undefined, 3000, 128)).toString('utf8').trim()
  if (!HASH.test(id)) throw new Error('Invalid block identifier')
  const data: unknown = JSON.parse(Buffer.from(await requestOtsBytes(new URL(`https://blockstream.info/api/block/${id.toLowerCase()}`), undefined, 3000, 8192)).toString('utf8'))
  if (!data || typeof data !== 'object') throw new Error('Invalid block response')
  const block = data as Record<string, unknown>
  if (block.id !== id || block.height !== height || typeof block.merkle_root !== 'string' || !HASH.test(block.merkle_root) ||
      typeof block.timestamp !== 'number' || !Number.isSafeInteger(block.timestamp) || block.timestamp < 1231006505 ||
      block.timestamp > Date.now() / 1000 + 7200) throw new Error('Inconsistent block response')
  return { root: block.merkle_root.toLowerCase(), time: block.timestamp }
}

/** Verify the proof, optionally binding it to an expected document SHA-256.
 * Uses a fixed HTTPS block explorer (trusted provider), not a local Bitcoin node.
 * Unconfirmed, unavailable, unsupported and invalid proofs all preserve the null API.
 */
export async function verifyProof(proofBase64: string, expectedSha256?: string): Promise<number | null> {
  if (typeof proofBase64 !== 'string' || !proofBase64.length || proofBase64.length > Math.ceil(MAX_PROOF_BYTES / 3) * 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(proofBase64) ||
      (expectedSha256 !== undefined && (typeof expectedSha256 !== 'string' || !HASH.test(expectedSha256)))) return null
  try {
    const bytes = Buffer.from(proofBase64, 'base64')
    if (bytes.length > MAX_PROOF_BYTES || bytes.toString('base64') !== proofBase64) return null
    const ots = await loadOts()
    const timestamp = ots.read(new Uint8Array(bytes))
    inspectTree(timestamp)
    if (expectedSha256 !== undefined && (timestamp.fileHash.algorithm !== 'sha256' ||
        Buffer.from(timestamp.fileHash.value).toString('hex') !== expectedSha256.toLowerCase())) return null
    await upgradeAllowed(ots, timestamp)
    const blocks = new Map<number, Promise<{ root: string; time: number }>>()
    const result = await ots.verify(timestamp, { bitcoin: async (message, leaf) => {
      if (leaf.type !== 'bitcoin' || message.length !== 32) return undefined
      if (!blocks.has(leaf.height)) blocks.set(leaf.height, blockAtHeight(leaf.height))
      const block = await blocks.get(leaf.height)!
      if (Buffer.from(message).reverse().toString('hex') !== block.root) throw new Error('Merkle root mismatch')
      return block.time
    } })
    const times = Object.keys(result.attestations).map(Number).filter(time => Number.isSafeInteger(time) && time > 0)
    return times.length ? Math.min(...times) : null
  } catch { return null }
}

export function formatBlockchainTimestamp(unixSeconds: number | null): string {
  if (typeof unixSeconds !== 'number' || !Number.isFinite(unixSeconds) || unixSeconds <= 0 || unixSeconds > 8640000000000) return pendingLabel
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(unixSeconds * 1000)) + ' (Bitcoin)'
}
