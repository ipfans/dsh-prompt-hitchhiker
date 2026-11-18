# @ipfans/dsh-prompt-hitchhiker

**中文** | [English](README.en.md)

把具名提示词模板注入 DeepSeek Harness 的系统提示词，每个新会话与子智能体都会生效，并按工作区与模型分别解析该用哪一套。

## 内置 Ponytail

插件自带 [Ponytail](https://github.com/DietrichGebert/ponytail)（MIT），一种编码模式：用最小的改动完整解决问题。

它**备好但不自动启用**——你不选中它，任何会话的行为都不会改变。

- 提示词正文是模板库里的一套模板，标有「内置」。可以设为全局默认、指定到某个工作区，或按模型匹配。
- 配套的五个 skill —— `ponytail-review`、`ponytail-audit`、`ponytail-debt`、`ponytail-gain`、`ponytail-help` —— 注册进 skill 目录，按需加载。在**选项**里可以整体关掉。
- 删除内置模板是永久的，「恢复 Ponytail」可以找回。

来源、从上游更新、许可见 [docs/PONYTAIL.zh.md](docs/PONYTAIL.zh.md)。

## 功能

- **模板库。** 任意数量的具名模板，每套一个正文；在设置里增删改和预览。
- **全局默认。** 一个模板在所有会话生效，除非有更窄的规则覆盖它。
- **按工作区。** 每个已注册工作区可选「跟随全局」「不注入」或指定某套模板。规则匹配会话目录本身，或最长的上层工作区路径。
- **按模型。** 规则按「开头是」「结尾是」「包含」匹配模型 id 或 provider id；按声明顺序取第一条命中。
- **子智能体。** 每个子智能体都是独立的 Session 与 Agent，因此同一个系统提示词分区天然覆盖它们。有一个开关可以跳过子智能体会话。
- **未生效的会话。** 模板生效前就已开始的会话，会在输入框上方看到提示，可一键把正文插入当前消息，或忽略。

优先级：工作区规则 → 第一条命中的模型规则 → 全局默认。

## 注入位置

分区注册在 order 50：位于部署人设（0）之后、工具指引（1000）之前。它不会在每一轮重复追加——提示词分区在每次组装时都会解析，但只有当渲染出的文本真正变化时，Session 才会记录一条系统消息，而这个分区的文本是存储文档的确定性函数。

## 相关位置

- 设置 → **提示词模板**：维护模板库与所有规则。
- 提示浮层出现在输入框卡片上方（`conversation.input.dock`）。
- 配置文档位于 `$DSH_HOME/storages/prompt-hitchhiker/config.json`（设置页会显示该路径），原子写入。文件变化后会被重新读取，所以改完下一步就生效，不用重启。
- 插件自身不发起任何模型请求；唯一的网络流量是页面访问它自己的 Host 路由。

## 关闭插件

停用 bundle 会移除注入正文和两个界面入口；JSON 文件保留在磁盘上，重新启用即可恢复模板库。

## 安装

```bash
dsh plugin install @ipfans/dsh-prompt-hitchhiker
```

或在 Plugin Manager 里搜索 `dsh-prompt-hitchhiker`。

## 许可证

MIT。内置的 Ponytail 提示词与 skill 版权归 DietrichGebert，同样以 MIT 分发，完整文本见 [LICENSE](LICENSE)。
