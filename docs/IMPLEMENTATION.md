# 实现方案 / Implementation

> 每次功能迭代或方案更新后刷新本文档，保持其反映当前实现而非历史。

最近更新：2026-05-16

## 1. 总体架构

```
React Renderer
  ↓ src/core/api.ts
window.cct.api(...)
  ↓ preload.ts / ipcRenderer.invoke("cct:api")
Electron main process
  ↓ electron/backend/*
local filesystem
```

cc-steward 不再启动 Python/FastAPI 后端，也不监听 localhost 业务端口。开发和生产都使用同一套 Electron IPC 后端。

## 2. 后端

后端位于 `electron/backend/`：

- `api.ts`：IPC 请求分发入口。
- `agents.ts`：Claude/Codex 配置定义与文件扫描。
- `files.ts`：文件详情、读取、写入、删除和 hooks 解析。
- `projects.ts`：从 Claude/Codex 本地配置发现项目。
- `config.ts`：解析多层配置的最终生效状态。
- `sync.ts`：Claude 到 Codex 的扫描、计划、dry-run 和执行。
- `skills.ts`：Skills 列表扫描（Claude `.claude/skills/*/SKILL.md`、Codex `.codex/skills/*.md`）。
- `subagents.ts`：子 Agent 列表扫描（Claude `.claude/agents/*.md`、Codex `.codex/agents/*.toml`）。
- `mcpServers.ts`：MCP Server 配置提取（Claude `settings.json`/`.mcp.json`、Codex `config.toml`）。
- `backup.ts`：导出配置 ZIP。
- `fsUtils.ts`：文件系统、路径和 JSON/TOML 辅助函数。

## 3. 前端通信

`src/core/api.ts` 保持原有业务方法形状，例如 `api.agents.list()`、`api.files.write()`、`api.sync.plan()`。内部不再使用 `fetch`，而是调用 `electronApi.backend()`。

`electron/preload.ts` 只暴露最小桥接能力，不开启 renderer 的 Node integration。

## 4. 构建

- `npm run dev`：启动 Vite 和 Electron。
- `npm run build:frontend`：构建 React renderer。
- `npm run build:electron`：编译 Electron main/preload/backend。
- `npm run test:backend`：运行 Electron backend TypeScript 测试。
- `npm run build`：完整打包桌面应用。

## 5. 前端模块

| 模块 | 路径 | 功能 |
|------|------|------|
| Overview | `src/modules/overview/` | 首页概览 — Agent 状态卡片 + 配置对照表 |
| AgentConfig | `src/modules/agent-config/` | Agent 详情三 Tab：总览 / 配置明细 / 配置生效树 |
| ActiveConfig | `src/modules/active-config/` | 当前生效的配置文件列表 |
| PathMapping | `src/modules/path-mapping/` | Claude ↔ Codex 文件对照表 |
| SyncCenter | `src/modules/sync/` | 同步概览（规则/映射/流程图）+ 独立同步执行面板（5 阶段） |
| Sessions | `src/modules/sessions/` | 会话管理 — 三视图导航（概览/列表/详情），Claude 和 Codex 分别注册 |
| Help | `src/modules/help/` | 帮助文档 + 配置关系树（ClaudeRelTree） |
| Settings | `src/modules/settings/` | 偏好设置（外观/快捷键/运行环境/关于） |
| FileDetail | `src/modules/config-files/` | 文件详情面板（编辑/删除/hooks 解析/同步状态） |

## 6. Claude 配置定义（13 项）

`src/agents/claude.ts` / `electron/backend/agents.ts` (`claudeSpecs`)

| key | 路径 | 范围 | 格式 |
|-----|------|------|------|
| `global_settings` | `~/.claude/settings.json` | global | json |
| `global_instructions` | `~/.claude/CLAUDE.md` | global | markdown |
| `global_auth` | `~/.claude.json` | global | json |
| `global_skills` | `~/.claude/skills/` | global | dir |
| `global_agents` | `~/.claude/agents/` | global | dir |
| `global_commands` | `~/.claude/commands/` | global | dir |
| `global_plugins` | `~/.claude/plugins/installed_plugins.json` | global | json |
| `project_instructions` | `{project}/CLAUDE.md` | project | markdown |
| `project_settings` | `{project}/.claude/settings.json` | project | json |
| `project_settings_local` | `{project}/.claude/settings.local.json` | project | json |
| `project_agents` | `{project}/.claude/agents/` | project | dir |
| `project_commands` | `{project}/.claude/commands/` | project | dir |
| `project_mcp` | `{project}/.claude/mcp.json` | project | json |

## 7. Codex 配置定义（11 项）

`src/agents/codex.ts` / `electron/backend/agents.ts` (`codexSpecs`)

| key | 路径 | 范围 | 格式 |
|-----|------|------|------|
| `global_config` | `~/.codex/config.toml` | global | toml |
| `global_instructions` | `~/.codex/AGENTS.md` | global | markdown |
| `global_hooks` | `~/.codex/hooks/` | global | dir |
| `global_agents` | `~/.codex/agents/` | global | dir |
| `global_skills` | `~/.codex/skills/` | global | dir |
| `global_memories` | `~/.codex/memories/` | global | dir |
| `global_auth` | `~/.codex/auth.json` | global | json |
| `project_config` | `{project}/.codex/config.toml` | project | toml |
| `project_instructions` | `{project}/AGENTS.md` | project | markdown |
| `project_hooks` | `{project}/.codex/hooks/` | project | dir |
| `project_agents` | `{project}/.codex/agents/` | project | dir |

## 8. 配置合并规则

**Claude settings.json（5 层，高→低）：**
1. 命令行参数（会话级覆盖）
2. `settings.local.json`（项目本地覆盖，不入 git）
3. `.claude/settings.json`（项目配置）
4. `~/.claude/settings.json`（全局配置）
5. 内置默认值

- 标量字段：后者覆盖前者
- `hooks` / `permissions`：各层追加合并

**CLAUDE.md（全部拼接注入，不覆盖）：**
1. `~/.claude/CLAUDE.md`（全局）
2. `{project}/CLAUDE.md`（项目根）
3. 子目录 `CLAUDE.md`（自动加载）

**Skills / Agents / Commands 作用域：**
- 全局定义在 `~/.claude/{skills,agents,commands}/`
- 项目级定义在 `{project}/.claude/{agents,commands}/`
- 项目级同名覆盖全局同名
- Skills 需子目录 + SKILL.md 结构；Commands 单 .md 文件即命令

## 9. 同步机制

`electron/backend/sync.ts` 提供 Claude → Codex 单向迁移，转换规则对齐 Codex 官方 `migrate-to-codex` skill（完整副本位于 `vendor/migrate-to-codex/`）。

| 类型 | 迁移方式 |
|------|----------|
| Instruction | CLAUDE.md → AGENTS.md；检测 Claude-only markers（/hooks、.claude/agents/、permissionMode 等），中立内容直接复制，含专有标记时提示审查 |
| Skill | `.claude/skills/*/SKILL.md` → `.agents/skills/*/SKILL.md`；保留 frontmatter，`allowed-tools` 转为 MANUAL MIGRATION REQUIRED 提示引导 |
| Agent | `.claude/agents/*.md` → `.codex/agents/*.toml`；含模型名映射（claude-opus→gpt-5.4 等）、effort 级别映射、permissionMode→sandbox_mode、tools/disallowedTools/skills 转为 developer_instructions 提示引导 |
| Command | `.claude/commands/*.md` → `.agents/skills/source-command-*/SKILL.md`；转换为 Codex skill，保留模板占位符并添加手动审查提示 |
| Hook | Claude settings.json hooks → `.codex/hooks.json`；仅迁移 command 类型处理器，需启用 `[features].codex_hooks = true` |
| Settings/MCP | Claude settings.json + .mcp.json → `.codex/config.toml`；含 personality="friendly"、模型映射、MCP server 配置转换（bearer_token_env_var、env_http_headers 规范化） |
| Plugin | 检测到插件时报告为需手动迁移，不自动转换 |

**模型映射表：**

| Claude 模型前缀 | Codex 模型 | effort 映射 |
|-----------------|-----------|------------|
| claude-opus | gpt-5.4 | low→low, medium→medium, high→high, max→xhigh |
| claude-sonnet | gpt-5.4-mini | low→medium, medium→high, high→xhigh, max→xhigh |
| claude-haiku | gpt-5.4-mini | low→low, medium→medium, high→high, max→xhigh |

**权限模式映射：** acceptEdits→workspace-write, readOnly→read-only

覆盖已有文件前自动备份为 `.bak.<YYYYMMDD-HHMMSS>`。

**同步流程（5 阶段）：**

1. `syncScan` — 扫描源目录，列出可迁移项
2. `syncPlan` — 生成迁移计划，标注冲突和状态
3. `syncDryRun` — 模拟写入，预览 would_write/would_skip/would_overwrite
4. `syncExecute` — 实际写入目标文件
5. `syncValidate` — 验证目标文件可用性

**验证项（`syncValidate`）：**

| 检查项 | 条件 |
|--------|------|
| AGENTS.md 大小 | >32KB 报 warning |
| Skill frontmatter | 缺少 name/description 报 error |
| Agent TOML 语法 | 解析失败报 error，缺少必填字段报 error |
| config.toml 语法 | 解析失败报 error |
| MCP command PATH | command 不在 PATH 报 warning |
| hooks.json 语法 | 解析失败报 error |

**迁移报告（`syncReport`）：** 生成 Markdown 格式，包含概要统计、逐项明细、警告与人工审查项、备份记录、验证结果。

## 10. 会话管理

后端位于 `electron/backend/sessions/`：

- `claudeSessions.ts`：Claude 会话发现 — 递归扫描 `~/.claude/projects/**/*.jsonl`（跳过 `subagents/`、`memory/`、`worktrees/`、`node_modules/` 目录，过滤 <200 字节文件）。轻量列表只读 stat + 前 1MB（`SCAN_LIMIT`）通过 `fastScanToolStats` 正则扫描提取工具/技能/子代理统计（技能从 `"name":"Skill"..."skill":"xxx"` 提取，子代理从 `"subagent_type":"xxx"` 提取）。详情支持分页（offset/limit），`normalizeMessages` 从 tool_use blocks 的 input 字段精确提取 `skillName`/`subagentName`。元数据行（permission-mode 等 8 种）自动过滤。`tool_use`/`tool_result` content blocks 拆分为独立消息，thinking blocks 跳过。
- `codexSessions.ts`：Codex 会话发现 — 扫描 `~/.codex/sessions/`，独立解析器支持 Codex JSONL 格式（session_meta / event_msg / response_item）。`extractMetaFast` 使用 regex 提取 cwd/id/title（避免 JSON.parse 22KB+ 的 session_meta 行）。支持 function_call、function_call_output、custom_tool_call 等工具消息。
- `sessionAnalytics.ts`：统计聚合 — `buildSessionStats`（从消息构建工具/技能/子代理统计）、`aggregateProjectsFromSummaries`/`buildOverviewFromSummaries`（从轻量 Summary 聚合，不需要读取全部消息）。
- `sessionSearch.ts`：全文搜索 — 遍历会话消息查找匹配，支持角色和工具名过滤，`maxResults` 上限 100，单文件 2MB 跳过。
- `sessionTrash.ts`：软删除 — 移动到回收区并写 manifest.json。
- `sessionWatchPaths.ts`：返回需要监听的目录路径。

**会话 ID：** `SHA1(agent:absolutePath)`，稳定且跨平台唯一。**Native ID：** 从文件名提取 UUID，用于 `claude --resume` 命令。

**前端三栏布局：**

| 区域 | 组件 | 功能 |
|------|------|------|
| 左侧边栏（280px） | `ProjectSidebar` | 项目树 + 会话列表，搜索，折叠展开 |
| 中间主内容 | `OverviewDashboard` 或 `ConversationViewer` | 概览仪表盘（统计/分布/TOP 工具技能/项目卡片）或聊天气泡对话查看 |
| 右侧面板（220px，条件显示） | `SessionStatsPanel` + `MessageNavigator` | 会话统计 + 消息角色导航（仅对话模式） |

**对话查看器特性：** 聊天气泡（用户蓝右对齐 / AI 白左对齐 / tool_use 蓝边框 / tool_result 琥珀边框 / 错误红色），角色过滤（全部/用户/AI），工具消息开关，可折叠长工具输出，分页加载（默认最后 50 条），一键复制项目路径/文件路径/Session ID/Resume 命令。
