# Bundled Ponytail

The library ships with [Ponytail](https://github.com/DietrichGebert/ponytail) by
[Dietrich Gebert](https://github.com/DietrichGebert), used under the MIT license.
Ponytail is a coding mode: the smallest change that fully solves the task, with
the checks that matter left in.

## What ships

| Piece | Where it lands | How it turns on |
|---|---|---|
| The prompt body | One library template, id `ponytail`, marked **Bundled** | Select it as the global default, pin it to a workspace, or match it by model |
| `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help` | The skill catalog, provider `prompt-hitchhiker-ponytail` | On by default; **Settings → Prompt templates → Options** turns them off |

The prompt is **not** enabled for you. A fresh install shows it in the library
and injects nothing until you select it, so no session changes behavior without
that choice.

The skills are a separate surface from the prompt: the prompt sets how the agent
works, the skills give it the one-shot reports by name without spending room in
the system prompt. They load on demand.

## Provenance

Both halves are copied verbatim from upstream `main`:

- `skills/ponytail/SKILL.md` → the template body (frontmatter removed)
- `skills/<name>/SKILL.md` → each skill's `description` (frontmatter) and `content`
  (the body after the frontmatter)

The text lives in [`ponytail.js`](../ponytail.js) as data rather than being read
from disk at runtime, because a bundle must work from inside an asar archive
where sibling-file reads are unavailable.

## Refreshing from upstream

Re-fetch the six files and regenerate the module. The generated file is the only
thing that changes; nothing else in the plugin knows the text.

```bash
# in a scratch directory
base=https://raw.githubusercontent.com/DietrichGebert/ponytail/main
curl -sL "$base/skills/ponytail/SKILL.md"        -o ph-skill.md
for s in review audit debt gain help; do
  curl -sL "$base/skills/ponytail-$s/SKILL.md"   -o "ph-ponytail-$s.md"
done
```

Then split each file at its YAML frontmatter, drop the frontmatter, and write
`PONYTAIL_PROMPT` plus `PONYTAIL_SKILLS` with the same export names.

## License

```
MIT License

Copyright (c) 2026 DietrichGebert

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
