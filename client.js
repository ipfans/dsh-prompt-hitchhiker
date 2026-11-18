/**
 * Prompt Hitchhiker — browser half.
 *
 * Two surfaces, both fed by the Host half's `/prompt-hitchhiker` routes:
 * - a Settings page (`settings.section`) that edits the template library and
 *   the global / per-workspace / per-model selection rules;
 * - a composer hint (`conversation.composer.dock`) for a Session that started
 *   before its template applied, offering to insert the body into the message
 *   the user is about to send.
 *
 * Every color comes from the shell's theme tokens, so both surfaces follow the
 * light and dark themes without a palette of their own.
 * @module @ipfans/dsh-prompt-hitchhiker/client
 */

window.__ModuleLoader__.load({
  id: '@ipfans/dsh-prompt-hitchhiker',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Dictionary namespace owned by this plugin. */
    const NS = 'prompt-hitchhiker'

    const EN = {
      'nav': 'Prompt templates',
      'title': 'Prompt templates',
      'intro': 'Named bodies injected into the system prompt, resolved per workspace and per model. An edit applies from the next assembled model step.',
      'section.templates': 'Templates',
      'section.templates.hint': 'One inline body per template. The resolved template is inserted once per session, before any tool guidance.',
      'section.scope': 'Default and scope',
      'section.scope.hint': 'A workspace rule wins over a model rule; a model rule wins over the global default.',
      'section.models': 'Model rules',
      'section.models.hint': 'The first enabled rule that matches the current model wins.',
      'section.options': 'Options',
      'empty.templates': 'No templates yet. Add one to start injecting.',
      'empty.rules': 'No model rules yet.',
      'rules.needsTemplate': 'A rule needs a template, so this also adds one.',
      'empty.workspaces': 'No workspaces are registered yet.',
      'field.name': 'Name',
      'field.text': 'Body',
      'field.enabled': 'Enabled',
      'field.provider': 'Provider',
      'field.model': 'Model',
      'field.workspace': 'Workspace',
      'field.defaultTemplate': 'Global default',
      'action.add': 'Add template',
      'action.addRule': 'Add model rule',
      'action.delete': 'Delete',
      'action.restoreBundled': 'Restore Ponytail',
      'action.preview': 'Preview',
      'action.hidePreview': 'Hide preview',
      'action.reload': 'Reload',
      'action.insert': 'Insert into message',
      'action.dismiss': 'Dismiss',
      'scope.global': 'Follow global',
      'scope.off': 'Do not inject',
      'scope.template': 'Use a template',
      'position.contains': 'Contains',
      'position.prefix': 'Starts with',
      'position.suffix': 'Ends with',
      'option.subagents': 'Also inject into subagent sessions',
      'option.hint': 'Offer an insert hint in sessions that started before a template applied',
      'option.skills': 'Make the bundled Ponytail skills available to agents',
      'option.skills.hint': 'Registers review, audit, debt, gain and help. Turn off to remove them from the skill catalog.',
      'global.none': 'No global default',
      'rule.on': 'On',
      'status.saved': 'Saved',
      'status.saving': 'Saving…',
      'status.error': 'Could not save: {message}',
      'status.loading': 'Loading…',
      'status.loadError': 'Could not load the template library: {message}',
      'status.storedAt': 'Stored at {path}',
      'preview.empty': 'This template is empty, so nothing is injected.',
      'preview.chars': '{count} characters',
      'hint.title': 'This session started before prompt template “{name}” applied',
      'hint.body': 'The template is injected into the system prompt when a session starts. Insert its body into this message to apply it here too.',
      'templates.disabled': 'Disabled',
      'templates.bundled': 'Bundled',
      'templates.bundled.hint': 'Ships with the plugin. Deleting it is permanent unless you restore it.',
    }

    const ZH = {
      'nav': '提示词模板',
      'title': '提示词模板',
      'intro': '把具名正文注入系统提示词，按工作区与模型分别解析。修改会在下一次组装模型步骤时生效。',
      'section.templates': '模板',
      'section.templates.hint': '每个模板一段正文；解析出的模板在每个会话中只插入一次，位置在工具指引之前。',
      'section.scope': '默认与范围',
      'section.scope.hint': '工作区规则优先于模型规则；模型规则优先于全局默认。',
      'section.models': '模型规则',
      'section.models.hint': '第一条启用且匹配当前模型的规则生效。',
      'section.options': '选项',
      'empty.templates': '还没有模板，添加一个即可开始注入。',
      'empty.rules': '还没有模型规则。',
      'rules.needsTemplate': '规则必须指向一套模板，所以会同时新建一套。',
      'empty.workspaces': '当前还没有已注册的工作区。',
      'field.name': '名称',
      'field.text': '正文',
      'field.enabled': '启用',
      'field.provider': '提供方',
      'field.model': '模型',
      'field.workspace': '工作区',
      'field.defaultTemplate': '全局默认模板',
      'action.add': '添加模板',
      'action.addRule': '添加模型规则',
      'action.delete': '删除',
      'action.restoreBundled': '恢复 Ponytail',
      'action.preview': '预览',
      'action.hidePreview': '收起预览',
      'action.reload': '重新加载',
      'action.insert': '插入到消息',
      'action.dismiss': '知道了',
      'scope.global': '跟随全局',
      'scope.off': '不注入',
      'scope.template': '指定模板',
      'position.contains': '包含',
      'position.prefix': '开头是',
      'position.suffix': '结尾是',
      'option.subagents': '子智能体会话也注入',
      'option.hint': '对模板生效前就已开始的会话，提示是否插入',
      'option.skills': '把内置的 Ponytail skills 提供给智能体',
      'option.skills.hint': '注册 review、audit、debt、gain、help 五个 skill。关闭后它们会从 skill 目录中移除。',
      'global.none': '不使用全局默认',
      'rule.on': '开',
      'status.saved': '已保存',
      'status.saving': '保存中…',
      'status.error': '保存失败：{message}',
      'status.loading': '加载中…',
      'status.loadError': '模板库加载失败：{message}',
      'status.storedAt': '存储位置：{path}',
      'preview.empty': '这个模板正文为空，不会注入任何内容。',
      'preview.chars': '{count} 个字符',
      'hint.title': '本会话开始于提示词模板“{name}”生效之前',
      'hint.body': '模板在会话开始时注入系统提示词。把它插入这条消息，本次对话也能应用。',
      'templates.disabled': '已停用',
      'templates.bundled': '内置',
      'templates.bundled.hint': '插件自带。删除后可用「恢复 Ponytail」找回。',
    }

    // ---------------------------------------------------------------- helpers

    /** Resolve one Host route against the page base (keeps a proxy prefix). */
    function routeUrl(path) {
      const base = typeof document !== 'undefined' && typeof document.baseURI === 'string' && document.baseURI !== ''
        ? document.baseURI
        : 'http://dsh.internal/'
      return new URL(path.replace(/^\/+/, ''), base.endsWith('/') ? base : `${base}/`).href
    }

    /** One JSON round trip against the Host half. */
    async function request(path, init) {
      const response = await fetch(routeUrl(path), {
        method: init?.method ?? 'GET',
        headers: init?.body === undefined ? {} : { 'content-type': 'application/json' },
        body: init?.body === undefined ? undefined : JSON.stringify(init.body),
        credentials: 'same-origin',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload.ok === false) {
        throw new Error(typeof payload.error === 'string' ? payload.error : `HTTP ${response.status}`)
      }
      return payload
    }

    /** A local id for a row created in the page. */
    function newId() {
      return Math.random().toString(36).slice(2, 10)
    }

    /** Replace one array entry by index. */
    function replaceAt(list, index, value) {
      return list.map((entry, position) => (position === index ? value : entry))
    }

    /** Drop one array entry by index. */
    function dropAt(list, index) {
      return list.filter((_, position) => position !== index)
    }

    // ----------------------------------------------------------------- styles

    const S = {
      page: { display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 2px 32px', color: 'var(--dsw-alias-label-primary)' },
      h1: { margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
      intro: { margin: 0, fontSize: 12.5, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' },
      card: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 14,
        borderRadius: 10,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-1)',
      },
      row: { display: 'flex', alignItems: 'center', gap: 8 },
      rowWrap: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      badge: {
        flex: 'none',
        padding: '2px 7px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 500,
        color: 'var(--dsw-alias-brand-primary)',
        border: '1px solid var(--dsw-alias-brand-primary)',
      },
      chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
      chip: {
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        color: 'var(--dsw-alias-label-secondary)',
        background: 'var(--dsw-alias-bg-layer-2)',
      },
      column: { display: 'flex', flexDirection: 'column', gap: 8 },
      grow: { flex: 1, minWidth: 0 },
      sectionTitle: { margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' },
      hint: { margin: 0, fontSize: 12, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' },
      label: { fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)' },
      input: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '6px 8px',
        fontSize: 13,
        lineHeight: 1.5,
        fontFamily: 'inherit',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-base)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 7,
        outline: 'none',
      },
      textarea: {
        width: '100%',
        boxSizing: 'border-box',
        minHeight: 108,
        resize: 'vertical',
        padding: 8,
        fontSize: 12.5,
        lineHeight: 1.6,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-base)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 7,
        outline: 'none',
      },
      select: {
        boxSizing: 'border-box',
        padding: '6px 8px',
        fontSize: 12.5,
        fontFamily: 'inherit',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-base)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 7,
        outline: 'none',
      },
      button: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 11px',
        fontSize: 12.5,
        fontFamily: 'inherit',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-base)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 7,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      primary: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        fontSize: 12.5,
        fontWeight: 500,
        fontFamily: 'inherit',
        color: 'var(--dsw-alias-bg-base)',
        background: 'var(--dsw-alias-brand-primary)',
        border: '1px solid transparent',
        borderRadius: 7,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      danger: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 10px',
        fontSize: 12.5,
        fontFamily: 'inherit',
        color: 'var(--dsw-alias-state-error-primary)',
        background: 'transparent',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 7,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      code: {
        margin: 0,
        padding: 10,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontSize: 12,
        lineHeight: 1.6,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 7,
        maxHeight: 260,
        overflow: 'auto',
      },
      meta: { fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)' },
      error: { fontSize: 12, color: 'var(--dsw-alias-state-error-primary)' },
      ok: { fontSize: 12, color: 'var(--dsw-alias-state-success-primary)' },
      checkbox: { width: 14, height: 14, accentColor: 'var(--dsw-alias-brand-primary)', cursor: 'pointer' },
      divider: { height: 1, background: 'var(--dsw-alias-border-l1)', margin: '2px 0' },
    }

    // ------------------------------------------------------------------ store

    /**
     * Page store: the last server snapshot plus the editable draft, with a
     * debounced save so typing never races the network.
     */
    class Library {
      constructor() {
        this.state = {
          status: 'idle',
          error: null,
          config: null,
          workspaces: [],
          bundledSkills: [],
          storePath: '',
          dirty: false,
          saveError: null,
          savedAt: 0,
        }
        this.listeners = new Set()
        this.timer = undefined
        this.version = 0
      }

      getSnapshot = () => this.state

      subscribe = (listener) => {
        this.listeners.add(listener)
        return () => { this.listeners.delete(listener) }
      }

      publish(patch) {
        this.state = { ...this.state, ...patch }
        for (const listener of this.listeners) listener()
      }

      async load() {
        this.publish({ status: 'loading', error: null })
        try {
          const payload = await request('prompt-hitchhiker/state')
          this.publish({
            status: 'ready',
            config: payload.config,
            workspaces: payload.workspaces ?? [],
            bundledSkills: payload.bundledSkills ?? [],
            storePath: payload.storePath ?? '',
            error: null,
            dirty: false,
          })
        } catch (error) {
          this.publish({ status: 'error', error: error instanceof Error ? error.message : String(error) })
        }
      }

      /** Apply one pure edit to the draft and schedule a save. */
      update(change) {
        const current = this.state.config
        if (current === null) return
        this.version += 1
        this.publish({ config: change(current), dirty: true, saveError: null })
        if (this.timer !== undefined) clearTimeout(this.timer)
        this.timer = setTimeout(() => {
          this.timer = undefined
          void this.save()
        }, 350)
      }

      /**
       * Ask the Host to put the bundled template back. This is a Host edit, so
       * it saves any pending local edit first and then adopts the result, which
       * keeps a debounced keystroke from being dropped by the round trip.
       */
      async restoreBundled() {
        if (this.timer !== undefined) {
          clearTimeout(this.timer)
          this.timer = undefined
        }
        try {
          if (this.state.dirty) await this.save()
          const payload = await request('prompt-hitchhiker/bundled', { method: 'POST', body: { op: 'restore' } })
          this.publish({
            config: payload.config,
            workspaces: payload.workspaces ?? [],
            bundledSkills: payload.bundledSkills ?? [],
            storePath: payload.storePath ?? '',
            dirty: false,
            saveError: null,
            savedAt: Date.now(),
          })
        } catch (error) {
          this.publish({ saveError: error instanceof Error ? error.message : String(error) })
        }
      }

      async save() {
        const draft = this.state.config
        if (draft === null) return
        const version = this.version
        this.publish({ status: 'saving' })
        try {
          const payload = await request('prompt-hitchhiker/config', {
            method: 'POST',
            body: { op: 'replace', config: draft },
          })
          if (version !== this.version) {
            // A later edit landed while this write was in flight; keep the newer
            // draft and let its own timer persist it.
            this.publish({ status: 'ready', savedAt: Date.now() })
            return
          }
          this.publish({
            status: 'ready',
            config: payload.config,
            workspaces: payload.workspaces ?? this.state.workspaces,
            storePath: payload.storePath ?? this.state.storePath,
            dirty: false,
            savedAt: Date.now(),
            saveError: null,
          })
        } catch (error) {
          this.publish({
            status: 'ready',
            dirty: true,
            saveError: error instanceof Error ? error.message : String(error),
          })
        }
      }

      dispose() {
        // Leaving the page must not drop a pending edit: the debounce exists to
        // coalesce keystrokes, not to swallow the last one.
        if (this.timer !== undefined) {
          clearTimeout(this.timer)
          this.timer = undefined
          if (this.state.dirty) void this.save()
        }
        this.listeners.clear()
      }
    }

    /** Subscribe one component to any { getSnapshot, subscribe } source. */
    function useSnapshot(source) {
      const [snapshot, setSnapshot] = React.useState(source.getSnapshot)
      React.useEffect(() => {
        const read = () => setSnapshot(source.getSnapshot())
        read()
        return source.subscribe(read)
      }, [source])
      return snapshot
    }

    // ------------------------------------------------------------ small parts

    function TextInput(props) {
      return h('input', {
        type: 'text',
        value: props.value,
        placeholder: props.placeholder ?? '',
        style: { ...S.input, ...props.style },
        onChange: event => props.onChange(event.target.value),
      })
    }

    function Select(props) {
      return h('select', {
        value: props.value,
        style: { ...S.select, ...props.style },
        onChange: event => props.onChange(event.target.value),
      }, props.options.map(option => h('option', { key: option.value, value: option.value }, option.label)))
    }

    function Checkbox(props) {
      return h('label', { style: { display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 7 } },
        h('input', {
          type: 'checkbox',
          checked: props.checked,
          style: S.checkbox,
          onChange: event => props.onChange(event.target.checked),
        }),
        h('span', { style: { fontSize: 12.5, color: 'var(--dsw-alias-label-primary)' } }, props.label))
    }

    function Button(props) {
      const disabled = props.disabled === true
      const base = props.variant === 'primary' ? S.primary : props.variant === 'danger' ? S.danger : S.button
      return h('button', {
        type: 'button',
        disabled,
        title: props.title,
        style: disabled ? { ...base, opacity: 0.5, cursor: 'not-allowed' } : base,
        onClick: disabled ? undefined : props.onClick,
      }, props.label)
    }

    function Card(props) {
      return h('section', { style: S.card },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 3 } },
          h('h3', { style: S.sectionTitle }, props.title),
          props.hint === undefined ? null : h('p', { style: S.hint }, props.hint)),
        props.children)
    }

    // ------------------------------------------------------------- templates

    function TemplateCard(props) {
      const { template, onChange, onDelete, t } = props
      const [preview, setPreview] = React.useState(false)
      const length = template.text.trim().length
      return h('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: 12,
          borderRadius: 9,
          border: '1px solid var(--dsw-alias-border-l1)',
          background: 'var(--dsw-alias-bg-base)',
        },
      },
      h('div', { style: S.rowWrap },
        h('div', { style: { ...S.grow, minWidth: 160 } },
          h(TextInput, {
            value: template.name,
            placeholder: t('field.name'),
            onChange: value => onChange({ ...template, name: value }),
          })),
        template.bundled === true
          ? h('span', { style: S.badge, title: t('templates.bundled.hint') }, t('templates.bundled'))
          : null,
        h(Checkbox, {
          checked: template.enabled,
          label: t('field.enabled'),
          onChange: value => onChange({ ...template, enabled: value }),
        }),
        h(Button, {
          label: preview ? t('action.hidePreview') : t('action.preview'),
          onClick: () => setPreview(value => !value),
        }),
        h(Button, { variant: 'danger', label: t('action.delete'), onClick: onDelete })),
      h('textarea', {
        value: template.text,
        placeholder: t('field.text'),
        style: S.textarea,
        onChange: event => onChange({ ...template, text: event.target.value }),
      }),
      h('div', { style: { ...S.row, justifyContent: 'space-between' } },
        h('span', { style: S.meta }, t('preview.chars', { count: length })),
        template.enabled ? null : h('span', { style: S.meta }, t('templates.disabled'))),
      preview
        ? (length === 0
          ? h('p', { style: S.hint }, t('preview.empty'))
          : h('pre', { style: S.code }, template.text))
        : null)
    }

    // -------------------------------------------------------------- sections

    function TemplatesSection(props) {
      const { config, update, store, t } = props
      return h(Card, { title: t('section.templates'), hint: t('section.templates.hint') },
        config.templates.length === 0
          ? h('p', { style: S.hint }, t('empty.templates'))
          : config.templates.map((template, index) => h(TemplateCard, {
            key: template.id,
            template,
            t,
            onChange: next => update(current => ({ ...current, templates: replaceAt(current.templates, index, next) })),
            onDelete: () => update(current => ({
              ...current,
              templates: dropAt(current.templates, index),
              globalTemplateId: current.globalTemplateId === template.id ? null : current.globalTemplateId,
              modelRules: current.modelRules.filter(rule => rule.templateId !== template.id),
              workspaceRules: current.workspaceRules.map(rule => (
                rule.templateId === template.id ? { path: rule.path, mode: 'global' } : rule
              )),
            })),
          })),
        h('div', { style: S.row },
          config.templates.some(template => template.bundled === true)
            ? null
            : h(Button, {
              label: t('action.restoreBundled'),
              onClick: () => { void store.restoreBundled() },
            }),
          h(Button, {
            label: t('action.add'),
            onClick: () => update((current) => {
              const created = { id: newId(), name: `Template ${current.templates.length + 1}`, text: '', enabled: true }
              return {
                ...current,
                templates: [...current.templates, created],
                globalTemplateId: current.globalTemplateId ?? created.id,
              }
            }),
          })))
    }

    function ScopeSection(props) {
      const { config, workspaces, update, t } = props
      const templateOptions = config.templates.map(template => ({ value: template.id, label: template.name || template.id }))
      const setWorkspace = (path, mode, templateId) => update((current) => {
        const rest = current.workspaceRules.filter(rule => rule.path !== path)
        if (mode === 'global') return { ...current, workspaceRules: rest }
        const entry = templateId === undefined || templateId === ''
          ? { path, mode }
          : { path, mode, templateId }
        return { ...current, workspaceRules: [...rest, entry] }
      })

      return h(Card, { title: t('section.scope'), hint: t('section.scope.hint') },
        h('div', { style: { ...S.column, gap: 4 } },
          h('span', { style: S.label }, t('field.defaultTemplate')),
          h(Select, {
            value: config.globalTemplateId ?? '',
            options: [{ value: '', label: t('global.none') }, ...templateOptions],
            onChange: value => update(current => ({ ...current, globalTemplateId: value === '' ? null : value })),
          })),
        h('div', { style: S.divider }),
        h('div', { style: S.column },
          h('span', { style: S.label }, t('field.workspace')),
          workspaces.length === 0
            ? h('p', { style: S.hint }, t('empty.workspaces'))
            : workspaces.map((workspace) => {
              const rule = config.workspaceRules.find(entry => entry.path === workspace.path)
              const mode = rule?.mode ?? 'global'
              return h('div', { key: workspace.path, style: { ...S.rowWrap, alignItems: 'flex-end' } },
                h('div', { style: { ...S.grow, minWidth: 140 } },
                  h('div', { style: { fontSize: 12.5, color: 'var(--dsw-alias-label-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                    workspace.title || workspace.path),
                  h('div', { style: { ...S.meta, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, workspace.path)),
                h(Select, {
                  value: mode,
                  options: [
                    { value: 'global', label: t('scope.global') },
                    { value: 'off', label: t('scope.off') },
                    { value: 'template', label: t('scope.template') },
                  ],
                  onChange: (value) => {
                    if (value === 'template') {
                      setWorkspace(
                        workspace.path,
                        'template',
                        rule?.templateId ?? config.globalTemplateId ?? config.templates[0]?.id ?? '',
                      )
                      return
                    }
                    setWorkspace(workspace.path, value)
                  },
                }),
                mode === 'template'
                  ? h(Select, {
                    value: rule?.templateId ?? '',
                    options: templateOptions,
                    onChange: value => setWorkspace(workspace.path, 'template', value),
                  })
                  : null)
            })))
    }

    function ModelRulesSection(props) {
      const { config, update, t } = props
      return h(Card, { title: t('section.models'), hint: t('section.models.hint') },
        config.modelRules.length === 0
          ? h('p', { style: S.hint }, t('empty.rules'))
          : config.modelRules.map((rule, index) => h('div', { key: rule.id, style: { ...S.rowWrap, alignItems: 'flex-end' } },
            h(Select, {
              value: rule.field,
              options: [
                { value: 'model', label: t('field.model') },
                { value: 'provider', label: t('field.provider') },
              ],
              onChange: value => update(current => ({ ...current, modelRules: replaceAt(current.modelRules, index, { ...rule, field: value }) })),
            }),
            h(Select, {
              value: rule.position,
              options: [
                { value: 'contains', label: t('position.contains') },
                { value: 'prefix', label: t('position.prefix') },
                { value: 'suffix', label: t('position.suffix') },
              ],
              onChange: value => update(current => ({ ...current, modelRules: replaceAt(current.modelRules, index, { ...rule, position: value }) })),
            }),
            h('div', { style: { ...S.grow, minWidth: 120 } },
              h(TextInput, {
                value: rule.value,
                placeholder: 'deepseek-v4',
                onChange: value => update(current => ({ ...current, modelRules: replaceAt(current.modelRules, index, { ...rule, value }) })),
              })),
            h(Select, {
              value: rule.templateId,
              options: config.templates.map(template => ({ value: template.id, label: template.name || template.id })),
              onChange: value => update(current => ({ ...current, modelRules: replaceAt(current.modelRules, index, { ...rule, templateId: value }) })),
            }),
            h(Checkbox, {
              checked: rule.enabled,
              label: t('rule.on'),
              onChange: value => update(current => ({ ...current, modelRules: replaceAt(current.modelRules, index, { ...rule, enabled: value }) })),
            }),
            h(Button, {
              variant: 'danger',
              label: t('action.delete'),
              onClick: () => update(current => ({ ...current, modelRules: dropAt(current.modelRules, index) })),
            }))),
        h('div', { style: S.row },
          h(Button, {
            label: t('action.addRule'),
            // A rule has to point at a template, so with an empty library the
            // button creates one rather than silently doing nothing.
            onClick: () => update((current) => {
              const templates = current.templates.length > 0
                ? current.templates
                : [{ id: newId(), name: `Template 1`, text: '', enabled: true }]
              return {
                ...current,
                templates,
                modelRules: [...current.modelRules, {
                  id: newId(),
                  field: 'model',
                  position: 'contains',
                  value: '',
                  templateId: templates[0].id,
                  enabled: true,
                }],
              }
            }),
          }),
          config.templates.length === 0
            ? h('span', { style: S.hint }, t('rules.needsTemplate'))
            : null))
    }

    function OptionsSection(props) {
      const { config, bundled, update, t } = props
      return h(Card, { title: t('section.options') },
        h(Checkbox, {
          checked: config.options.applyToSubagents,
          label: t('option.subagents'),
          onChange: value => update(current => ({ ...current, options: { ...current.options, applyToSubagents: value } })),
        }),
        h(Checkbox, {
          checked: config.options.showComposerHint,
          label: t('option.hint'),
          onChange: value => update(current => ({ ...current, options: { ...current.options, showComposerHint: value } })),
        }),
        h(Checkbox, {
          checked: config.options.enablePonytailSkills !== false,
          label: t('option.skills'),
          onChange: value => update(current => ({ ...current, options: { ...current.options, enablePonytailSkills: value } })),
        }),
        h('p', { style: S.hint }, t('option.skills.hint')),
        bundled.length === 0
          ? null
          : h('div', { style: S.chips }, bundled.map(skill => h('span', { key: skill.name, style: S.chip }, skill.name))))
    }

    function SettingsPage(props) {
      const { store, t } = props
      const snapshot = useSnapshot(store)
      if (snapshot.status === 'idle' || snapshot.status === 'loading') {
        return h('div', { style: S.page }, h('p', { style: S.hint }, t('status.loading')))
      }
      if (snapshot.status === 'error') {
        return h('div', { style: S.page },
          h('p', { style: S.error }, t('status.loadError', { message: snapshot.error ?? '' })),
          h('div', { style: S.row }, h(Button, { label: t('action.reload'), onClick: () => { void store.load() } })))
      }
      const config = snapshot.config
      const update = change => store.update(change)
      const status = snapshot.saveError !== null
        ? h('span', { style: S.error }, t('status.error', { message: snapshot.saveError }))
        : snapshot.dirty
          ? h('span', { style: S.meta }, t('status.saving'))
          : snapshot.savedAt > 0
            ? h('span', { style: S.ok }, t('status.saved'))
            : null
      return h('div', { style: S.page },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
          h('h2', { style: S.h1 }, t('title')),
          h('p', { style: S.intro }, t('intro'))),
        h(TemplatesSection, { config, update, store, t }),
        h(ScopeSection, { config, workspaces: snapshot.workspaces, update, t }),
        h(ModelRulesSection, { config, update, t }),
        h(OptionsSection, { config, bundled: snapshot.bundledSkills ?? [], update, t }),
        h('div', { style: { ...S.row, justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 } },
          h('span', { style: S.meta }, t('status.storedAt', { path: snapshot.storePath })),
          h('div', { style: { ...S.row, gap: 8 } },
            status,
            h(Button, { label: t('action.reload'), onClick: () => { void store.load() } }))))
    }

    // ----------------------------------------------------------- composer hint

    function ComposerHint(props) {
      const { t, sessionId, inputActions, useInput } = props
      const draft = useInput(state => state.draft)
      const [status, setStatus] = React.useState(null)

      React.useEffect(() => {
        let live = true
        if (typeof sessionId !== 'string' || sessionId === '') return undefined
        request(`prompt-hitchhiker/session?sessionId=${encodeURIComponent(sessionId)}`)
          .then((payload) => { if (live) setStatus(payload.status) })
          .catch(() => { if (live) setStatus(null) })
        return () => { live = false }
      }, [sessionId])

      if (status === null || status.showHint !== true || status.suggested === null) return null

      const acknowledge = () => {
        setStatus(current => (current === null ? current : { ...current, showHint: false }))
        void request('prompt-hitchhiker/ack', { method: 'POST', body: { op: 'ack', sessionId } }).catch(() => {})
      }

      const insert = () => {
        const body = status.suggested.text
        inputActions.setDraft(draft.trim() === '' ? body : `${body}\n\n${draft}`)
        acknowledge()
      }

      return h('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          boxSizing: 'border-box',
          maxWidth: 720,
          margin: '0 0 8px',
          padding: '10px 12px',
          borderRadius: 9,
          border: '1px solid var(--dsw-alias-border-l1)',
          background: 'var(--dsw-alias-bg-layer-1)',
        },
      },
      h('div', { style: { fontSize: 12.5, fontWeight: 500, color: 'var(--dsw-alias-label-primary)' } },
        t('hint.title', { name: status.suggested.templateName ?? '' })),
      h('div', { style: { fontSize: 12, lineHeight: 1.6, color: 'var(--dsw-alias-label-secondary)' } }, t('hint.body')),
      h('div', { style: { ...S.row, gap: 8 } },
        h(Button, { variant: 'primary', label: t('action.insert'), onClick: insert }),
        h(Button, { label: t('action.dismiss'), onClick: acknowledge })))
    }

    // ------------------------------------------------------------ registration

    /** Services this half needs before it can register anything. */
    const inject = ['slots', 'locale']

    /**
     * Register both surfaces.
     * @param ctx - the Client context of this package.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { en: EN, zh: ZH }), 'prompt-hitchhiker: dictionaries')
      const t = ctx.locale.bind(NS)
      const library = new Library()

      ctx.effect(() => {
        void library.load()
        return () => { library.dispose() }
      }, 'prompt-hitchhiker: library load')

      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'prompt-hitchhiker',
        order: 40,
        label: () => t('nav'),
        locale: NS,
        inject: () => ({ store: library, t }),
      }, SettingsPage))

      // `conversation.input.dock` is the full-width seat above the composer
      // card, which is what this hint is: a card, not one of the dock's
      // compact pills.
      ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
        name: 'conversation.input.dock',
        id: 'prompt-hitchhiker-hint',
        order: 15,
        locale: NS,
        inject: () => ({ t }),
      }, ComposerHint))
    }

    return { inject, apply }
  },
})
