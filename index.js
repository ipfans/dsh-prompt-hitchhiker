/**
 * Prompt Hitchhiker — Host half.
 *
 * Owns one named-template library, the global / per-workspace / per-model
 * selection rules, and the single system-prompt section that injects the
 * resolved template body.
 *
 * Injection timing. A prompt section is resolved once per assembled model step,
 * which is exactly the lifecycle the feature needs:
 * - a new Session assembles its first system prompt before its first request,
 *   so the body is present from the very first turn;
 * - every subagent is its own Session and Agent, so the same global provider
 *   covers child agents with no per-agent registration (`AssembleContext`
 *   carries the Agent, and its Session header marks subagent origin);
 * - the rendered text is a pure function of the durable document, so every
 *   later step renders identical text and the Session log records it once
 *   instead of appending a fresh copy per turn.
 *
 * Placement. `SECTION_ORDER` 50 sits after the deployment persona (0) and
 * before the first tool guidance (1000).
 *
 * The Client half talks to this module through the `/prompt-hitchhiker` route
 * family registered here. Every route answers only a trusted browser peer,
 * through the same `ctx.connection.requestRejection` fence the `/api` gateway
 * uses.
 *
 * Persistence is one JSON document under
 * `$DSH_HOME/storages/prompt-hitchhiker/config.json`, written atomically. It is
 * plugin-owned state, never the profile patch file.
 * @module dsh-prompt-hitchhiker
 */

import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve as resolvePath, sep } from 'node:path'

import {
  PONYTAIL_PROMPT,
  PONYTAIL_SKILLS,
  PONYTAIL_TEMPLATE_NAME,
} from './ponytail.js'

/** Stable id of the bundled template, so seeding survives a re-read. */
const PONYTAIL_TEMPLATE_ID = 'ponytail'

/**
 * Provider name for the bundled skills. The registry requires every candidate
 * to report the same `provider` as its registration, so this string is both.
 */
const PONYTAIL_PROVIDER = 'prompt-hitchhiker-ponytail'

/** Prompt section name owned by this plugin. */
const SECTION_NAME = 'prompt-hitchhiker'

/**
 * Section order: the deployment persona occupies order 0 and the first tool
 * guidance order 1000, so 50 lands the injected body between them.
 */
const SECTION_ORDER = 50

/** Largest accepted JSON request body (the whole document is a few KiB). */
const MAX_BODY_BYTES = 4 * 1024 * 1024

/** Route family root; the Client half resolves the same relative path. */
const ROUTE_ROOT = '/prompt-hitchhiker'

/** Sessions remembered as "hint dismissed or text inserted" (bounded FIFO). */
const ACK_LIMIT = 500

/** Cap on remembered injections, so a long-lived process cannot grow forever. */
const INJECTION_LIMIT = 2000

/**
 * A document with no selection but the bundled template already in the library.
 *
 * Composing this is how a fresh install gets Ponytail without opting in: it is
 * in the library and ready, and nothing injects until the user selects it.
 */
function emptyConfig() {
  return {
    version: 1,
    templates: [ponytailTemplate()],
    globalTemplateId: null,
    modelRules: [],
    workspaceRules: [],
    options: { applyToSubagents: true, showComposerHint: true, enablePonytailSkills: true },
  }
}

/** @returns the string, or the fallback for a non-string. */
function text(value, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

/** @returns a non-empty trimmed string, or `undefined`. */
function idOf(value) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/** Normalize one template row. */
function normalizeTemplate(raw) {
  if (typeof raw !== 'object' || raw === null) return undefined
  return {
    id: idOf(raw.id) ?? randomUUID().slice(0, 8),
    name: text(raw.name).trim() || 'Untitled template',
    text: text(raw.text),
    enabled: raw.enabled !== false,
    // Round-tripped so the Client can label the bundled row and offer to
    // restore it without treating a user copy as the original.
    ...(raw.bundled === true ? { bundled: true } : {}),
  }
}

/** Normalize one model-matching rule. */
function normalizeModelRule(raw) {
  if (typeof raw !== 'object' || raw === null) return undefined
  const templateId = idOf(raw.templateId)
  // A rule without a template has nothing to inject, so it stays dropped.
  // An empty needle is kept: that is the state a freshly added rule is in, and
  // `matchesRule` already treats it as matching nothing.
  if (templateId === undefined) return undefined
  return {
    id: idOf(raw.id) ?? randomUUID().slice(0, 8),
    field: raw.field === 'provider' ? 'provider' : 'model',
    position: raw.position === 'prefix' || raw.position === 'suffix' ? raw.position : 'contains',
    value: text(raw.value).trim(),
    templateId,
    enabled: raw.enabled !== false,
  }
}

/** Normalize one workspace rule, keyed by directory path. */
function normalizeWorkspaceRule(raw) {
  if (typeof raw !== 'object' || raw === null) return undefined
  const path = idOf(raw.path)
  if (path === undefined) return undefined
  const mode = raw.mode === 'off' || raw.mode === 'template' ? raw.mode : 'global'
  const templateId = idOf(raw.templateId)
  return {
    path,
    mode,
    ...mode === 'template' && templateId !== undefined ? { templateId } : {},
  }
}

/**
 * Coerce one request payload into a complete, internally consistent document.
 * Unusable rows are dropped rather than rejecting the whole write, so a Client
 * bug cannot wedge the plugin; the result is what gets persisted.
 */
function normalizeConfig(raw) {
  if (typeof raw !== 'object' || raw === null) return emptyConfig()
  const seen = new Set()
  const templates = (Array.isArray(raw.templates) ? raw.templates : [])
    .map(normalizeTemplate)
    .filter((template) => {
      if (template === undefined || seen.has(template.id)) return false
      seen.add(template.id)
      return true
    })
  const keep = value => (value !== undefined && seen.has(value) ? value : undefined)
  const modelRules = (Array.isArray(raw.modelRules) ? raw.modelRules : [])
    .map(normalizeModelRule)
    .filter(rule => rule !== undefined && seen.has(rule.templateId))
  const workspaceRules = (Array.isArray(raw.workspaceRules) ? raw.workspaceRules : [])
    .map(normalizeWorkspaceRule)
    .filter(rule => rule !== undefined && (rule.mode !== 'template' || seen.has(rule.templateId)))
  const options = typeof raw.options === 'object' && raw.options !== null ? raw.options : {}
  return {
    version: 1,
    templates,
    globalTemplateId: keep(idOf(raw.globalTemplateId)) ?? null,
    modelRules,
    workspaceRules,
    options: {
      applyToSubagents: options.applyToSubagents !== false,
      showComposerHint: options.showComposerHint !== false,
      enablePonytailSkills: options.enablePonytailSkills !== false,
    },
  }
}

/**
 * The bundled Ponytail row, as a template.
 *
 * Seeded into a library that has never been written rather than merged into
 * every read: once the file exists, its contents are the user's, and deleting
 * this row must stay deleted.
 * @returns a template row carrying the bundled prompt.
 */
function ponytailTemplate() {
  return {
    id: PONYTAIL_TEMPLATE_ID,
    name: PONYTAIL_TEMPLATE_NAME,
    text: PONYTAIL_PROMPT,
    enabled: true,
    bundled: true,
  }
}

/** @returns whether a template row is the bundled one. */
function isPonytail(template) {
  return template !== undefined && template.id === PONYTAIL_TEMPLATE_ID
}

/** @returns the template with this id, or undefined. */
function templateById(config, id) {
  if (typeof id !== 'string' || id === '') return undefined
  return config.templates.find(template => template.id === id)
}

/** @returns whether one rule matches the given model route. */
function matchesRule(rule, input) {
  const needle = rule.value.trim().toLowerCase()
  if (needle === '') return false
  const raw = rule.field === 'provider' ? input.provider : input.model
  const target = text(raw).toLowerCase()
  if (target === '') return false
  if (rule.position === 'prefix') return target.startsWith(needle)
  if (rule.position === 'suffix') return target.endsWith(needle)
  return target.includes(needle)
}

const canonicalCache = new Map()

/**
 * Canonicalize a directory for rule matching. `realpath` may fail for a
 * directory that vanished; the resolved spelling is then good enough.
 */
function canonicalPath(path) {
  if (typeof path !== 'string' || path === '') return undefined
  const cached = canonicalCache.get(path)
  if (cached !== undefined) return cached
  let canonical
  try {
    canonical = realpathSync.native(path)
  } catch {
    canonical = resolvePath(path)
  }
  canonicalCache.set(path, canonical)
  if (canonicalCache.size > 2000) canonicalCache.delete(canonicalCache.keys().next().value)
  return canonical
}

/**
 * Find the workspace rule governing one session directory: an exact match
 * wins, otherwise the longest enclosing workspace path.
 */
function workspaceRuleFor(config, cwd) {
  const target = canonicalPath(cwd)
  if (target === undefined) return undefined
  let best
  let bestLength = -1
  for (const rule of config.workspaceRules) {
    const base = canonicalPath(rule.path)
    if (base === undefined) continue
    if (target !== base && !target.startsWith(base.endsWith(sep) ? base : base + sep)) continue
    if (base.length > bestLength) {
      best = rule
      bestLength = base.length
    }
  }
  return best
}

/**
 * Resolve the template that applies to one assembly.
 *
 * Precedence, most specific first: an explicit workspace rule (either `off`,
 * which stops everything, or a named template), then the first matching model
 * rule in declared order, then the global default. A workspace left on
 * `global` therefore still lets model rules apply.
 * @param config - current document.
 * @param input - session directory, model route, and subagent marker.
 * @returns the winning template and the reason it won.
 */
function resolveTemplate(config, input) {
  if (input.isSubagent === true && config.options.applyToSubagents === false) {
    return { template: undefined, source: 'subagent-skipped' }
  }
  const workspace = workspaceRuleFor(config, input.cwd)
  if (workspace !== undefined && workspace.mode === 'off') {
    return { template: undefined, source: 'workspace-off' }
  }
  if (workspace !== undefined && workspace.mode === 'template') {
    const template = templateById(config, workspace.templateId)
    if (template !== undefined && template.enabled) return { template, source: 'workspace' }
  }
  for (const rule of config.modelRules) {
    if (rule.enabled === false || !matchesRule(rule, input)) continue
    const template = templateById(config, rule.templateId)
    if (template !== undefined && template.enabled) return { template, source: 'model' }
  }
  const fallback = templateById(config, config.globalTemplateId)
  if (fallback !== undefined && fallback.enabled) return { template: fallback, source: 'global' }
  return { template: undefined, source: 'none' }
}

/**
 * Read the persisted document. A missing or unreadable file is an empty
 * library, never a crash: activation must survive a hand-edited file.
 */
function readConfig(path) {
  try {
    return normalizeConfig(JSON.parse(readFileSync(path, 'utf8')))
  } catch {
    return emptyConfig()
  }
}

/** Identity of the current file contents, or `undefined` when absent. */
function stampOf(path) {
  try {
    const info = statSync(path)
    return `${String(info.mtimeMs)}:${String(info.size)}:${String(info.ino)}`
  } catch {
    return undefined
  }
}

/** Write the document atomically so a crash cannot truncate the library. */
function writeConfig(path, config) {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.tmp`
  writeFileSync(temp, `${JSON.stringify(config, undefined, 2)}\n`, 'utf8')
  renameSync(temp, path)
}

/** Resolve the DSH home the same way the rest of the installation does. */
function resolveHome() {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return fromEnv
  return join(homedir(), '.dsh')
}

/** Write one JSON response. */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

/** Read and parse one JSON request body, refusing oversized payloads. */
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (raw.trim() === '') {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('body is not valid JSON'))
      }
    })
    req.on('error', reject)
  })
}

/**
 * Register the Host half.
 * @param ctx - Cordis context of this Loader entry.
 */
export function apply(ctx) {
  const storePath = join(resolveHome(), 'storages', 'prompt-hitchhiker', 'config.json')
  /** Last document read or written here, with the file stamp it came from. */
  let cached = { config: readConfig(storePath), stamp: stampOf(storePath) }
  /** sessionId -> last successful injection. */
  const injections = new Map()
  /**
   * Sessions that have already assembled a system prompt. The composer hint
   * only makes sense for these: a session that has run a step without the
   * template is one that started before it applied, while a session that has
   * never run a step will simply get the template on its first one.
   */
  const assembled = new Set()
  /** sessionIds whose composer hint was acted on or dismissed. */
  const acknowledged = new Set()

  /**
   * Current document. The file is the source of truth, so a hand edit or a
   * write from another window takes effect without a restart; only a change to
   * the file stamp triggers a re-read, and an unchanged file returns the
   * identical object, so resolution stays deterministic across steps.
   */
  const readDocument = () => {
    const stamp = stampOf(storePath)
    if (stamp !== cached.stamp) {
      cached = { config: readConfig(storePath), stamp }
    }
    return cached.config
  }

  /** Resolve the model route for one assembly, from the step or the agent. */
  const routeOf = (context) => {
    const selection = context.modelSelection
    if (selection !== undefined && selection !== null) {
      return { provider: selection.provider, model: selection.model }
    }
    try {
      const agent = context.agent
      const live = agent?.model?.current?.()
      if (live !== undefined && live !== null) return { provider: live.provider, model: live.model }
      const options = agent?.options
      if (options?.provider !== undefined && options?.model !== undefined) {
        return { provider: options.provider, model: options.model }
      }
    } catch {
      // A disposed agent may reject access; an unknown route simply skips model rules.
    }
    return { provider: undefined, model: undefined }
  }

  /** Describe one agent's session for rule matching. */
  const sessionOf = (context) => {
    const header = context.agent?.session?.header
    if (header === undefined || header === null) return undefined
    return {
      id: header.id,
      cwd: typeof header.cwd === 'string' ? header.cwd : undefined,
      isSubagent: header.origin === 'subagent' || header.parentSession !== undefined,
    }
  }

  ctx.inject(['systemPrompt'], (child) => {
    child.effect(() => child.systemPrompt.section({
      name: SECTION_NAME,
      order: SECTION_ORDER,
      // The body is user-authored prose, so `{{name}}` stays literal instead of
      // being interpolated as a prompt variable.
      interpolate: false,
      text: (context) => {
        const session = sessionOf(context)
        if (session === undefined) return ''
        assembled.add(session.id)
        if (assembled.size > INJECTION_LIMIT) assembled.delete(assembled.values().next().value)
        const route = routeOf(context)
        const config = readDocument()
        const resolution = resolveTemplate(config, {
          cwd: session.cwd,
          provider: route.provider,
          model: route.model,
          isSubagent: session.isSubagent,
        })
        const body = resolution.template?.text.trim() ?? ''
        if (body === '') return ''
        injections.set(session.id, {
          templateId: resolution.template.id,
          templateName: resolution.template.name,
          source: resolution.source,
          model: route.model ?? null,
          at: Date.now(),
        })
        if (injections.size > INJECTION_LIMIT) injections.delete(injections.keys().next().value)
        return body
      },
    }), 'prompt-hitchhiker: system prompt section')
  })

  /**
   * Register the bundled companion skills.
   *
   * A skill is a separate catalog surface from the prompt: the prompt sets how
   * the agent works, these give it the one-shot reports by name (review, audit,
   * debt, gain, help) without spending room in the system prompt.
   *
   * Registered as a provider rather than as fixed runtime skills so the "off"
   * switch is read on every catalog listing and takes effect without a restart.
   * This never writes the seeded file: a fresh install keeps the skills even
   * after the user edits the library, and turning them off clears the catalog.
   */
  ctx.inject(['skills'], (child) => {
    child.effect(() => child.skills.registerProvider(() => {
      const enabled = () => readDocument().options.enablePonytailSkills !== false
      const summary = skill => ({
        name: skill.name,
        description: skill.description,
        invocation: { modelInvocable: true, userInvocable: true },
        source: 'bundled',
        provider: PONYTAIL_PROVIDER,
      })
      return {
        name: PONYTAIL_PROVIDER,
        list: async () => {
          if (!enabled()) return []
          return PONYTAIL_SKILLS.map(skill => ({
            ...summary(skill),
            rank: 0,
            locator: skill.name,
          }))
        },
        get: async (candidate) => {
          if (!enabled()) return undefined
          const skill = PONYTAIL_SKILLS.find(entry => entry.name === candidate.locator)
          if (skill === undefined) return undefined
          return { ...summary(skill), content: skill.content }
        },
      }
    }), 'prompt-hitchhiker: ponytail skills')
  })

  /** The bundled skills contributed by this plugin. */
  const bundledSkills = () => PONYTAIL_SKILLS.map(skill => ({
    name: skill.name,
    description: skill.description,
  }))

  /** Workspace catalogue for the Client rule editor. */
  const listWorkspaces = () => {
    const registry = ctx.get('workspaceRegistry')
    if (registry === undefined) return []
    try {
      return registry.list().map(workspace => ({
        id: workspace.id,
        path: workspace.path,
        title: workspace.title,
      }))
    } catch {
      return []
    }
  }

  /** Snapshot the Client renders from. */
  const snapshot = () => ({
    config: readDocument(),
    workspaces: listWorkspaces(),
    bundledSkills: bundledSkills(),
    storePath,
  })

  /**
   * Materialize the seeded library on first write.
   *
   * Reads fall back to the seeded document, so a fresh install shows Ponytail
   * without the plugin creating a file just by loading. The first real edit
   * pins that document to disk, so what the user then sees and edits is exactly
   * what was persisted.
   */
  const persist = (config) => {
    writeConfig(storePath, config)
    cached = { config, stamp: stampOf(storePath) }
  }

  /** Resolve a hypothetical assembly, for the settings preview. */
  const preview = (input) => {
    const resolution = resolveTemplate(readDocument(), {
      cwd: text(input?.cwd) || undefined,
      provider: text(input?.provider) || undefined,
      model: text(input?.model) || undefined,
      isSubagent: input?.isSubagent === true,
    })
    const body = resolution.template?.text ?? ''
    return {
      templateId: resolution.template?.id ?? null,
      templateName: resolution.template?.name ?? null,
      source: resolution.source,
      injected: body.trim() !== '',
      text: body,
    }
  }

  /** Per-session status the composer hint reads. */
  const sessionStatus = (sessionId) => {
    if (typeof sessionId !== 'string' || sessionId === '') {
      return { injected: false, showHint: false, suggested: null, injection: null }
    }
    const injected = injections.get(sessionId)
    let candidate = { injected: false, text: '', templateId: null, templateName: null, source: 'none' }
    try {
      const agent = ctx.get('agents')?.get?.(sessionId)
      const header = agent?.session?.header
      const route = agent?.model?.current?.()
      candidate = preview({
        cwd: header?.cwd,
        provider: route?.provider,
        model: route?.model,
        isSubagent: header?.origin === 'subagent',
      })
    } catch {
      // An unknown or disposed session keeps the "not applied" reading.
    }
    const showHint = readDocument().options.showComposerHint !== false
      && assembled.has(sessionId)
      && injected === undefined
      && !acknowledged.has(sessionId)
      && candidate.injected
    return {
      injected: injected !== undefined,
      injection: injected ?? null,
      assembled: assembled.has(sessionId),
      acknowledged: acknowledged.has(sessionId),
      showHint,
      suggested: showHint
        ? { templateId: candidate.templateId, templateName: candidate.templateName, text: candidate.text }
        : null,
    }
  }

  /** Replace the whole document from a Client edit. */
  const replace = (payload) => {
    persist(normalizeConfig(payload))
    try {
      ctx.emit('system-prompt/change')
    } catch {
      // The event is optional; the next assembly still reads the new document.
    }
    return snapshot()
  }

  /**
   * Put the bundled template back, at its canonical position.
   *
   * Deleting it is permanent (the file is the user's), so this is the way back
   * that does not require hand-editing JSON.
   */
  const restoreBundled = () => {
    const config = readDocument()
    if (config.templates.some(isPonytail)) return replace(config)
    persist(normalizeConfig({
      ...config,
      templates: [ponytailTemplate(), ...config.templates],
    }))
    try {
      ctx.emit('system-prompt/change')
    } catch {
      // Optional event, as above.
    }
    return snapshot()
  }

  /** Dispatch one route request. */
  const handle = async (req, res, pathname) => {
    const connection = ctx.get('connection')
    if (connection !== undefined
      && typeof connection.requestRejection === 'function'
      && connection.requestRejection(req) !== undefined) {
      sendJson(res, 403, { ok: false, error: 'forbidden' })
      return
    }
    const suffix = pathname.slice(ROUTE_ROOT.length)
    if (req.method === 'GET' && (suffix === '/state' || suffix === '' || suffix === '/')) {
      sendJson(res, 200, { ok: true, ...snapshot() })
      return
    }
    if (req.method === 'GET' && suffix === '/session') {
      const requestUrl = new URL(req.url ?? '/', 'http://dsh.internal')
      const sessionId = requestUrl.searchParams.get('sessionId') ?? undefined
      sendJson(res, 200, { ok: true, status: sessionStatus(sessionId) })
      return
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'method not allowed' })
      return
    }
    let body
    try {
      body = await readJson(req)
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : 'invalid body' })
      return
    }
    const op = text(body?.op)
    if (suffix === '/config' && op === 'replace') {
      sendJson(res, 200, { ok: true, ...replace(body.config) })
      return
    }
    if (suffix === '/resolve' && op === 'preview') {
      sendJson(res, 200, { ok: true, resolution: preview(body.input) })
      return
    }
    if (suffix === '/ack' && op === 'ack') {
      const sessionId = text(body.sessionId)
      if (sessionId !== '') {
        acknowledged.add(sessionId)
        if (acknowledged.size > ACK_LIMIT) acknowledged.delete(acknowledged.values().next().value)
      }
      sendJson(res, 200, { ok: true })
      return
    }
    if (suffix === '/bundled' && op === 'restore') {
      sendJson(res, 200, { ok: true, ...restoreBundled() })
      return
    }
    sendJson(res, 404, { ok: false, error: 'unknown operation' })
  }

  ctx.inject(['webServer'], (child) => {
    child.effect(() => child.webServer.register({
      kind: 'prefix',
      path: ROUTE_ROOT,
      handler: async (req, res) => {
        try {
          const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
          await handle(req, res, pathname)
        } catch (error) {
          if (!res.headersSent) {
            sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : 'internal error' })
          } else {
            res.end()
          }
        }
      },
    }), 'prompt-hitchhiker: http routes')
  })
}
