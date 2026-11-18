# @ipfans/dsh-prompt-hitchhiker

[中文](README.md) | **English**

Inject named prompt templates into the DeepSeek Harness system prompt of every new session and subagent, resolved by workspace and by model.

## Bundled: Ponytail

The library ships with [Ponytail](https://github.com/DietrichGebert/ponytail) (MIT), a coding mode that writes the smallest change that fully solves the task.

It arrives **ready to select, not active** — no session changes behavior until you pick it.

- The prompt body is one template in the library, marked **Bundled**. Select it as the global default, pin it to a workspace, or match it by model.
- Its five companion skills — `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help` — register in the skill catalog and load on demand. A switch in **Options** removes them.
- Deleting the template is permanent; **Restore Ponytail** puts it back.

Provenance, refreshing from upstream, and the license: [docs/PONYTAIL.md](docs/PONYTAIL.md).

## What it does

- **Template library.** Any number of named templates, each with one inline body, created, edited, deleted, and previewed in Settings.
- **Global default.** One template applies everywhere unless a narrower rule says otherwise.
- **Per workspace.** Each registered workspace is either *follow global*, *do not inject*, or pinned to a named template. A rule matches the session's directory exactly, or the longest enclosing workspace path.
- **Per model.** Rules match the model id (or the provider id) by *starts with*, *ends with*, or *contains*; the first matching rule in declared order wins.
- **Subagents.** Every subagent is its own Session and Agent, so the same system-prompt section covers them. A switch can skip subagent sessions.
- **Not-yet-applied sessions.** A session that started before a template applied gets a hint above the composer that inserts the body into the current message, or can be dismissed.

Precedence is workspace rule → first matching model rule → global default.

## Where the text lands

The section registers at order 50: after the deployment persona (order 0) and before the first tool guidance (order 1000). It is not re-appended each turn: prompt sections resolve on every assembled step, but the Session records a system message only when the rendered text actually changes, and this section's text is a deterministic function of the stored document.

## Where things live

- Settings → **Prompt templates** edits the library and every rule.
- The hint appears above the composer card (`conversation.input.dock`).
- The document lives at `$DSH_HOME/storages/prompt-hitchhiker/config.json` (shown on the settings page) and is written atomically. It is re-read when the file changes, so an edit takes effect on the next step without a restart.
- The plugin makes no model requests of its own; the only network traffic is the page talking to its own Host route.

## Turning it off

Disabling the bundle removes the injected text and both UI surfaces; the JSON file stays on disk, so re-enabling restores the library.

## Install

```bash
dsh plugin install @ipfans/dsh-prompt-hitchhiker
```

Or search for `dsh-prompt-hitchhiker` in Plugin Manager.

## License

MIT. The bundled Ponytail prompt and skills are copyright DietrichGebert, distributed under the same MIT license; see [LICENSE](LICENSE) for the full text.
