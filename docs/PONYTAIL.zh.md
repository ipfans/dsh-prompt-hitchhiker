# 内置 Ponytail

插件自带 [Ponytail](https://github.com/DietrichGebert/ponytail)（作者
[Dietrich Gebert](https://github.com/DietrichGebert)，MIT 许可）。Ponytail 是一种编码模式：
用最小的改动完整解决问题，该留的检查一处不少。

## 附带什么

| 内容 | 落在哪 | 怎么生效 |
|---|---|---|
| 提示词正文 | 模板库中的一套模板，id 为 `ponytail`，标有「内置」 | 选为全局默认、指定到某个工作区，或按模型匹配 |
| `ponytail-review`、`ponytail-audit`、`ponytail-debt`、`ponytail-gain`、`ponytail-help` | skill 目录，provider 为 `prompt-hitchhiker-ponytail` | 默认开启；在**设置 → 提示词模板 → 选项**里可关闭 |

提示词**不会**替你启用。全新安装只是在库里放好这套模板、不注入任何会话，直到你自己选中它——
没有这一步，任何会话的行为都不会改变。

skill 与提示词是两个独立的面：提示词决定工作方式，skill 按名字提供一次性报告，
不占用系统提示词的空间，按需加载。

## 来源

两部分都逐字取自上游 `main`：

- `skills/ponytail/SKILL.md` → 模板正文（去掉 frontmatter）
- `skills/<name>/SKILL.md` → 每个 skill 的 `description`（frontmatter）与 `content`
  （frontmatter 之后的正文）

正文以数据形式存放在 [`ponytail.js`](../ponytail.js)，而不是运行时从磁盘读取：
bundle 必须能在 asar 包内工作，那里读不到同级文件。

## 从上游更新

重新抓取那六个文件并重新生成该模块。需要改的只有生成出来的文件，
插件其余部分不认识正文内容。

```bash
# 在一个临时目录里
base=https://raw.githubusercontent.com/DietrichGebert/ponytail/main
curl -sL "$base/skills/ponytail/SKILL.md"        -o ph-skill.md
for s in review audit debt gain help; do
  curl -sL "$base/skills/ponytail-$s/SKILL.md"   -o "ph-ponytail-$s.md"
done
```

然后按各自的 YAML frontmatter 切分、丢掉 frontmatter，用相同的导出名写入
`PONYTAIL_PROMPT` 与 `PONYTAIL_SKILLS`。

## 许可

MIT License，版权归 Copyright (c) 2026 DietrichGebert。完整许可文本见
[`docs/PONYTAIL.md`](PONYTAIL.md)。
