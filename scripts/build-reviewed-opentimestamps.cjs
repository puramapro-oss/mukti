// Reproducible source provenance for an unpublished upstream library.
// Build only the pinned public LGPL source; no repository refs or credentials.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const repo = process.cwd();
const work = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP, 'mukti-ots-build-'));
const source = path.join(work, 'upstream');
const pack = path.join(work, 'package');
const commit = '12ba7b2c4f4cd1b8ce52d2c17be5efedca3bceab';
const run = (command, args, cwd = work) => execFileSync(command, args, { cwd, stdio: 'inherit' });
fs.mkdirSync(source); fs.mkdirSync(pack);
run('git', ['init'], source);
run('git', ['fetch', '--depth=1', 'https://github.com/opentimestamps/typescript-opentimestamps.git', commit], source);
run('git', ['checkout', '--detach', commit], source);
if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim() !== commit) throw new Error('Wrong upstream source');
run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--save-exact', 'typescript@5.8.3', '@noble/hashes@1.8.0']);
fs.cpSync(path.join(source, 'src'), path.join(pack, 'src'), { recursive: true });
for (const name of ['LICENSE', 'README.md']) fs.copyFileSync(path.join(source, name), path.join(pack, name));
fs.copyFileSync(path.join(source, 'package.json'), path.join(pack, 'UPSTREAM-package.json'));
const upstream = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
if (upstream.license !== 'LGPL-3.0-or-later') throw new Error('Unexpected upstream license');
run(process.execPath, [path.join(work, 'node_modules/typescript/bin/tsc'), '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'bundler', '--strict', '--skipLibCheck', '--declaration', '--declarationDir', path.join(pack, 'dist/types'), '--outDir', path.join(pack, 'dist/esm'), path.join(pack, 'src/index.ts')]);
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}
// Rewrite only parsed ESM imports/exports, never examples inside documentation.
// Original TypeScript and license headers remain preserved.
const ts = require(path.join(work, 'node_modules/typescript'));
for (const file of files(path.join(pack, 'dist/esm'))) {
  if (!file.endsWith('.js')) continue;
  let text = fs.readFileSync(file, 'utf8');
  const parsed = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const edits = [];
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!specifier || !ts.isStringLiteral(specifier) || !specifier.text.startsWith('.')) continue;
    const spec = specifier.text;
    if (spec.endsWith('.js')) continue;
    const resolved = path.resolve(path.dirname(file), spec);
    const replacement = fs.existsSync(resolved + '.js') ? spec + '.js' : fs.existsSync(path.join(resolved, 'index.js')) ? spec + '/index.js' : null;
    if (!replacement) throw new Error('Unresolved emitted import: ' + spec);
    edits.push({ start: specifier.getStart(parsed), end: specifier.getEnd(), text: JSON.stringify(replacement) });
  }
  for (const edit of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
  fs.writeFileSync(file, text);
}
const manifest = {
  name: '@opentimestamps/typescript-opentimestamps', version: '0.1.0-upstream.12ba7b2',
  description: 'Locally packaged, pinned upstream source. Not an official npm release.',
  license: upstream.license, repository: upstream.repository, type: 'module',
  main: './dist/esm/index.js', types: './dist/types/index.d.ts',
  exports: { types: './dist/types/index.d.ts', import: './dist/esm/index.js', default: './dist/esm/index.js' },
  files: ['dist', 'src', 'LICENSE', 'README.md', 'UPSTREAM-package.json', 'PROVENANCE.json', 'REBUILD.cjs'],
  dependencies: { '@noble/hashes': '1.8.0' },
};
const hashes = {};
for (const file of files(path.join(pack, 'src'))) hashes[path.relative(pack, file)] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const provenance = { upstream: 'https://github.com/opentimestamps/typescript-opentimestamps', commit, license: upstream.license, compiler: 'typescript@5.8.3', sources: hashes, change: 'Packaging only; emitted relative ESM imports receive extensions. All original TypeScript sources are included.' };
fs.writeFileSync(path.join(pack, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(pack, 'PROVENANCE.json'), JSON.stringify(provenance, null, 2) + '\n');
fs.copyFileSync(__filename, path.join(pack, 'REBUILD.cjs'));
const vendor = path.join(repo, 'vendor'); fs.mkdirSync(vendor, { recursive: true });
const result = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', vendor], { cwd: pack, encoding: 'utf8' }));
const name = 'typescript-opentimestamps-upstream-12ba7b2.tgz';
fs.renameSync(path.join(vendor, result[0].filename), path.join(vendor, name));
provenance.archiveSha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(vendor, name))).digest('hex');
fs.writeFileSync(path.join(vendor, 'typescript-opentimestamps-provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
console.log(JSON.stringify({ archive: 'vendor/' + name, sha256: provenance.archiveSha256, license: provenance.license, sourceFiles: Object.keys(hashes).length }));
