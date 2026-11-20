import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { lstat, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// Capacitor wraps the hosted Next application. Its native build needs the plugins
// declared by that application and TypeScript to read capacitor.config.ts.
const root = resolve(import.meta.dirname, '../..')
const readJson = async path => JSON.parse(await readFile(path, 'utf8'))
const modules = join(root, 'node_modules')
const existing = await lstat(modules).catch(error => {
  if (error.code !== 'ENOENT') throw error
})
assert.ok(!existing, 'Native CI requires a fresh checkout; existing node_modules will be preserved')
const manifest = await readJson(join(root, 'package.json'))
const lock = await readJson(join(root, 'package-lock.json'))
const nativePackages = Object.keys(manifest.dependencies).filter(name => name.startsWith('@capacitor/'))
const dependencies = Object.fromEntries([...nativePackages, 'typescript'].map(name => [
  name, lock.packages[`node_modules/${name}`].version,
]))
const nativeManifest = { name: manifest.name, version: manifest.version, private: true, dependencies }
const stage = await mkdtemp(join(process.env.RUNNER_TEMP || tmpdir(), 'mukti-wrapper-'))
const lockPath = join(stage, 'package-lock.json')
await writeFile(join(stage, 'package.json'), JSON.stringify(nativeManifest))
await writeFile(lockPath, JSON.stringify({ ...lock, packages: { ...lock.packages, '': nativeManifest } }))

// Let npm select its own transitive tree using the application's existing lock.
// This step cannot contact a registry or the private web dependency.
const npm = (args) => execFileSync('npm', args, { cwd: stage, stdio: 'inherit' })
const options = ['--ignore-scripts', '--no-audit', '--no-fund']
npm(['install', '--package-lock-only', '--offline', ...options])
const selected = await readJson(lockPath)
for (const [path, dep] of Object.entries(selected.packages)) {
  if (!path) continue
  const canonical = lock.packages[path]
  assert.ok(canonical?.integrity && new URL(dep.resolved).origin === 'https://registry.npmjs.org', path)
  assert.deepEqual([dep.version, dep.integrity, dep.resolved], [canonical.version, canonical.integrity, canonical.resolved], path)
}
npm(['ci', ...options])
await symlink(join(stage, 'node_modules'), modules, 'dir')
console.log(`Installed ${Object.keys(selected.packages).length - 1} locked native packages for ${manifest.name}`)
