/** Verify the exact dependency path used by Capacitor. Only generated temporary files are touched. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'

const require = createRequire(import.meta.url)
const capPath = require.resolve('@capacitor/cli/package.json')
const capRequire = createRequire(capPath)
const rimrafRequire = createRequire(capRequire.resolve('rimraf'))
const globRequire = createRequire(rimrafRequire.resolve('glob'))
const glob = rimrafRequire('glob')
const rimraf = capRequire('rimraf')

async function withFiles(run) {
  const root = await mkdtemp(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'mukti-glob-check-'))
  try {
    await mkdir(path.join(root, 'nested'))
    await writeFile(path.join(root, 'keep.txt'), 'keep')
    await writeFile(path.join(root, 'nested', 'remove.tmp'), 'temporary')
    await writeFile(path.join(root, 'nested', 'keep.txt'), 'keep')
    await run(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test('Capacitor resolves the reviewed patched glob and minimatch versions', () => {
  assert.equal(rimrafRequire('glob/package.json').version, '14.0.2')
  assert.equal(globRequire('minimatch/package.json').version, '11.0.1')
  const lock = require('../../package-lock.json')
  assert.equal(require('@capacitor/cli/package.json').version, lock.packages['node_modules/@capacitor/cli'].version)
})

test('async glob preserves nested file matching semantics', () => withFiles(async root => {
  assert.deepEqual((await glob.glob('**/*.txt', { cwd: root, nodir: true })).sort(), ['keep.txt', 'nested/keep.txt'])
}))

test('an already cancelled traversal rejects rather than reporting completion', () => withFiles(async root => {
  const controller = new AbortController()
  controller.abort(new Error('controlled-cancellation'))
  await assert.rejects(glob.glob('**/*', { cwd: root, signal: controller.signal }))
}))

test('rimraf glob deletion retains nonmatching files', () => withFiles(async root => {
  await rimraf.rimraf(path.join(root, 'nested', '*.tmp'), { glob: true })
  await assert.rejects(access(path.join(root, 'nested', 'remove.tmp')))
  assert.equal(await readFile(path.join(root, 'nested', 'keep.txt'), 'utf8'), 'keep')
  assert.equal(await readFile(path.join(root, 'keep.txt'), 'utf8'), 'keep')
}))

test('rimraf directory deletion retains the sibling file', () => withFiles(async root => {
  await rimraf.rimraf(path.join(root, 'nested'))
  await assert.rejects(access(path.join(root, 'nested')))
  assert.equal(await readFile(path.join(root, 'keep.txt'), 'utf8'), 'keep')
}))

test('Capacitor CLI can report its locked version without invoking a native build', () => {
  const manifest = require('@capacitor/cli/package.json')
  const executable = path.join(path.dirname(capPath), manifest.bin.cap)
  const output = execFileSync(process.execPath, [executable, '--version'], { encoding: 'utf8', timeout: 10_000 })
  assert.equal(output.trim(), manifest.version)
})
