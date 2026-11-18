/**
 * Release gate: everything that can break a published bundle, checked from the
 * packed file list rather than the working tree.
 *
 * Run by hand with `npm run check`, and by the publish workflow before it
 * uploads anything.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const problems = []
const check = (condition, message) => {
  if (!condition) problems.push(message)
}

/** Parse one JSON file, reporting a clear failure instead of a stack trace. */
const json = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    problems.push(`${path}: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}

// 1. Syntax of every shipped module. The Client half is browser code, but it is
// still parsed as a module here, which catches the typos a browser would.
for (const file of ['index.js', 'client.js', 'ponytail.js']) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
  } catch (error) {
    problems.push(`${file}: ${error instanceof Error ? error.stdout?.toString() ?? error.message : String(error)}`)
  }
}

const manifest = json('package.json')
const en = json('locale/en.json')
const zh = json('locale/zh.json')

if (manifest !== undefined) {
  // 2. The manifest is the identity the registry and the loader both key on.
  check(/^@[a-z0-9-]+\/[a-z0-9-]+$/.test(manifest.name), `package name is not a scoped name: ${manifest.name}`)
  check(manifest.publishConfig?.access === 'public', 'publishConfig.access must be public')
  check(manifest.dsh?.bundle?.patch !== undefined, 'dsh.bundle.patch is missing')
  check(manifest.exports?.['.'] !== undefined, 'exports["."] is missing')
  check(manifest.exports?.['./client'] !== undefined, 'exports["./client"] is missing')
  check(manifest.exports?.['./icon'] !== undefined, 'exports["./icon"] is missing')
  check(manifest.exports?.['./locale/*.json'] !== undefined, 'exports["./locale/*.json"] is missing')

  // 3. The Client half registers under a module id the Web loader matches to the
  // package name. A mismatch loads nothing and shows no error in the page.
  const client = readFileSync('client.js', 'utf8')
  const id = /__ModuleLoader__\.load\(\{\s*id:\s*'([^']+)'/.exec(client)?.[1]
  check(id === manifest.name, `client.js registers id "${id}", expected "${manifest.name}"`)

  // 4. The patch has to name this package, or the Host row points nowhere.
  const patch = readFileSync('cordis.patch.yml', 'utf8')
  check(patch.includes(manifest.name), `cordis.patch.yml does not name ${manifest.name}`)
}

// 5. Both locale files must carry the display metadata Plugin Manager reads,
// and every detail document they name must exist.
for (const [label, dict] of [['locale/en.json', en], ['locale/zh.json', zh]]) {
  if (dict === undefined) continue
  check(typeof dict.meta?.title === 'string' && dict.meta.title.length > 0, `${label}: meta.title is missing`)
  check(typeof dict.meta?.description === 'string' && dict.meta.description.length > 0, `${label}: meta.description is missing`)
  if (dict.meta?.detail !== undefined) {
    try {
      check(readFileSync(dict.meta.detail, 'utf8').trim().length > 0, `${label}: ${dict.meta.detail} is empty`)
    } catch {
      problems.push(`${label}: meta.detail points at a missing file: ${dict.meta.detail}`)
    }
  }
}

// 6. The Client dictionaries must agree: a key in one language and not the other
// renders the raw key to a user.
const keys = (text) => new Set([...text.matchAll(/^\s*'([a-zA-Z.]+)':/gm)].map(match => match[1]))
const clientSource = readFileSync('client.js', 'utf8')
const enBlock = clientSource.slice(clientSource.indexOf('const EN = {'), clientSource.indexOf('const ZH = {'))
const zhBlock = clientSource.slice(clientSource.indexOf('const ZH = {'), clientSource.indexOf('// -------------------------------------------------------'))
const enKeys = keys(enBlock)
const zhKeys = keys(zhBlock)
check(enKeys.size > 0 && zhKeys.size > 0, 'client dictionaries could not be parsed')
for (const key of enKeys) if (!zhKeys.has(key)) problems.push(`locale: "${key}" is in en and missing in zh`)
for (const key of zhKeys) if (!enKeys.has(key)) problems.push(`locale: "${key}" is in zh and missing in en`)

// 7. Publish exactly what the manifest says: the packed list is what a user
// installs, and `files` does not filter a linked directory during development.
let packed = []
try {
  const raw = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8' })
  packed = JSON.parse(raw)[0].files.map(file => file.path)
} catch (error) {
  problems.push(`npm pack --dry-run failed: ${error instanceof Error ? error.message : String(error)}`)
}

if (packed.length > 0) {
  for (const required of ['index.js', 'client.js', 'ponytail.js', 'cordis.patch.yml', 'icon.svg', 'locale/en.json', 'locale/zh.json', 'LICENSE', 'README.md']) {
    check(packed.includes(required), `packed bundle is missing ${required}`)
  }
  // A detail document named by a locale must actually ship with the package.
  for (const dict of [en, zh]) {
    const detail = dict?.meta?.detail
    if (detail !== undefined) check(packed.includes(detail), `packed bundle is missing ${detail}`)
  }
}

if (problems.length > 0) {
  console.error(`check failed (${problems.length}):`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

console.log(`check passed: ${packed.length} files, ${enKeys.size} locale keys, ${manifest?.name}@${manifest?.version}`)
