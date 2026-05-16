# Changelog

记录每一次功能迭代与方案更新。新条目放最前。  
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

---

## [1.3.0] — 2026-05-16

### 新增
- **Token 用量统计**：从 JSONL 的 `message.usage` 结构化提取 input/output/cache_creation/cache_read tokens，概览仪表盘展示总 Token、输入/输出 Token、Token 分布（含缓存读取/创建）卡片；右侧会话统计面板展示详细 Token 用量
- **模型分布统计**：从 assistant 消息的 `message.model` 字段（Claude）和 `turn_context.payload.model`（Codex）提取模型名称，概览仪表盘展示「模型分布」卡片（indigo 标签），右侧面板展示会话级模型使用
- **Turn 耗时统计**：从 `type: "system", subtype: "turn_duration"` 行提取 `durationMs`（仅 Claude），概览展示总耗时，右侧面板展示总耗时和平均轮次耗时；Codex 无可靠 duration 字段时展示 "—"
- **Summary 层快速扫描**：`fastScanToolStats` 新增 model/token/duration 提取，Summary 列表不需要全量解析即可获得上述统计数据
- **Detail 层结构化提取**：`normalizeMessages` 从 assistant 消息提取 `model`/`tokenUsage`，从 system/turn_duration 提取 `durationMs`，`buildSessionStats` 聚合为 `models`/`tokenUsage`/`turnCount`/`avgTurnDurationMs`
- **SessionSummary 新增 `topTools`/`topModels`**：携带真实调用次数，Overview 聚合按次数累加（而非按会话出现次数计数）

### 改进
- **Token 口径统一**：Claude `inputTokens` 从「仅新增输入」改为「总输入 = input + cache_read + cache_creation」，与 Codex `input_tokens`（已含缓存）对齐，两个 Agent 的数值现在可直接对比
- **Codex 列表性能 10x 提升**：`readCodexSummary` 从全量读取 + 全量 JSON.parse 改为只读前 1MB + regex 快扫 + 线性缩放（1056ms → 111ms）
- **SessionStats 扩展**：新增 `tokenUsage`、`models`、`totalDurationMs`、`turnCount`、`avgTurnDurationMs` 字段
- **SessionSummary 扩展**：新增 `tokenUsage`、`topModelNames`、`totalDurationMs`、`topTools`、`topModels` 字段
- **SessionOverview 扩展**：新增 `tokenUsage`、`topModels`、`totalDurationMs` 字段
- **消除循环依赖**：`emptyTokenUsage` 提取到独立的 `tokenUtils.ts`

### 修复
- **Codex model 双倍计数**：`turn_context` 行中 `payload.model` 和 `collaboration_mode.settings.model` 被全局 regex 匹配两次；改为 per-line JSON.parse 只提取 `payload.model`
- **Codex toolCallCount 翻倍**：`buildSessionStats` 将 `tool_use` 和 `tool_result` 都算作工具调用；改为只计 `subType === 'tool_use'` 或有 `toolName` 的消息
- **Codex detail 层 model 为空**：`normalizeCodexRow` 增加 `turn_context` 处理，提取 model 到 system 消息
- **Codex token 累计值误用**：`total_token_usage` 是累计值而非增量值，改用 `last_token_usage` 逐行累加
- **Codex 总耗时显示 "0ms"**：Codex 无 `turn_duration` 字段时改为展示 "—"

---

## [1.2.0] — 2026-05-16

### 改进
- **会话管理 UI 三栏重构**（参考 claude-code-history-viewer）：
  - **左侧边栏**：项目树 + 会话列表，搜索栏，项目折叠展开，选中高亮
  - **中间主内容**：概览仪表盘（统计卡片 + Agent 分布 + 工具/技能 TOP 8 + 项目卡片）或对话查看器
  - **右侧面板**：会话统计 + 消息导航（仅对话模式显示）
  - **对话查看器**：聊天气泡风格（用户蓝 / AI 白 / 工具琥珀），头像区分角色，工具消息可折叠，时间戳，分页加载
  - 角色过滤（全部/用户/AI）、工具消息开关、删除/复制路径操作栏
- **轻量级会话列表**：`listSessions` 不再读取并解析全部消息，改为只读取文件 stat + 前 4KB 提取标题和项目路径，大幅降低列表加载时间
- **会话详情分页**：`sessions.detail` 新增 `offset/limit` 参数，默认返回最后 50 条消息；前端支持「加载更早/更多消息」翻页
- **概览轻量聚合**：`sessions.overview` 和 `sessions.projects` 不再需要读取全部会话详情，直接从 Summary 聚合
- **搜索边界**：会话搜索新增 `maxResults`（默认 100）和单文件 2MB 上限，避免大文件扫描卡顿
- **复制操作**：对话查看器顶栏支持一键复制项目路径、文件路径、Session ID（UUID）、Resume 命令（`claude --resume <uuid>`）

### 修复
- **空消息过滤**：Claude JSONL 元数据行（permission-mode、file-history-snapshot、attachment、ai-title、last-prompt、queue-operation、summary、result）不再显示为空消息
- **工具消息拆分**：`tool_use` 和 `tool_result` content blocks 现在拆分为独立消息，分别以蓝色（调用）和琥珀色（结果）样式展示；错误结果显示红色
- **thinking block 过滤**：AI 思考块不再显示在对话中
- **技能/子代理名称误识别**：修复 skill 和 subagent 统计使用宽泛正则匹配自然语言（导致出现 "should"、"to"、"based" 等垃圾名称）；改为从 JSON 结构化字段（`"skill":"name"`、`"subagent_type":"name"`）精确提取
- **工具统计概览归零**：修复 `fastScanToolStats` 正则扫描策略，Summary 层现在正确携带工具/技能/子代理数据，Overview 仪表盘不再全部为 0

### 新增
- **Codex 会话解析器**（`codexSessions.ts`）：完整支持 Codex JSONL 格式（session_meta / event_msg / response_item），正确提取项目路径和会话 ID
  - 支持 event_msg（user_message / agent_message）和 response_item（function_call / function_call_output / message / custom_tool_call）
  - `extractMetaFast`：regex 提取 cwd/id/title，避免解析 22KB+ 的 session_meta 行
- **子代理文件过滤**：`collectSessionFiles` 跳过 `subagents/`、`memory/`、`worktrees/`、`node_modules/` 目录，并过滤小于 200 字节的文件（消除 `.meta.json` 干扰）

---

## [1.1.2] — 2026-05-15

### 改进
- **同步引擎对齐官方 migrate-to-codex**：完整重写 `electron/backend/sync.ts`，对齐 Codex 官方迁移 skill 的转换规则
  - Skills 目标路径修正：`.codex/skills/` → `.agents/skills/`（含子目录结构 `SKILL.md`）
  - Skill 转换新增 `allowed-tools` → MANUAL MIGRATION REQUIRED 提示引导
  - Commands 从"不可迁移"改为自动转换为 Codex skill（模板占位符保留 + 手动审查提示）
  - Agent 转换新增：模型名称映射（claude-opus→gpt-5.4 等）、effort 级别映射、permissionMode→sandbox_mode、tools/disallowedTools/skills 转为 developer_instructions 提示引导
  - 新增 Hooks 同步面：Claude hooks → `.codex/hooks.json`（含 features.codex_hooks 标志）
  - 新增 Settings/MCP 同步面：Claude settings.json + .mcp.json → `.codex/config.toml`（含 personality="friendly"、模型映射、MCP server 转换含 bearer_token_env_var/env_http_headers 规范化）
  - 新增 Plugin 报告面：检测到插件时标记为需手动迁移
  - Instruction 新增 Claude-only markers 检测（/hooks、.claude/agents/、permissionMode 等），区分中立内容与需审查内容
  - Skill support 目录复制：迁移 skill 时同步复制 `scripts/`、`references/`、`assets/` 子目录下的所有文件
- **同步中心横向对比视图**：展开同步项改为双栏布局，左右并排对比；支持两个 Tab — 「转换对比」（Claude 源 → 转换结果）和「目标预览」（当前 Codex 文件 → 同步后内容）；新文件场景显示"文件不存在"占位 + 绿色高亮
- **同步中心 UI 新增 MCP/Plugin 类型标签**
- **同步中心概览/流程分离**：默认页面改为同步概览（展示同步方向、5 阶段流程图、7 类转换规则表、模型/权限映射卡片），点击「开始同步流程」进入独立的同步执行面板，支持「返回概览」
- **同步流程分步导航**：扫描结果、转换计划、预演结果、执行报告、验证结果改为分步展示（每次只显示当前阶段），顶部步骤条显示进度并支持点击回看已完成步骤

### 修复
- **同步计划未传递覆盖模式**：`syncPlan` 前端调用未传 `replace` 参数，导致勾选覆盖模式后仍显示"有冲突"
- **scope=全部时项目重复**：全局和项目同时扫描时同一目标路径生成重复项，新增按 target 去重（项目级优先）

### 新增
- **Post-migration 验证**（`syncValidate`）：执行同步后可一键验证目标文件 — TOML 语法检查、Skill frontmatter 必填字段、AGENTS.md 32KB 大小阈值、MCP server command PATH 可用性、hooks.json 语法
- **迁移报告下载**（`syncReport`）：生成 Markdown 格式可保存报告，含概要统计、逐项明细（状态/类型/路径/说明）、警告与人工审查项、备份记录、验证结果
- **同步中心验证 UI**：执行完成后显示「验证目标文件」按钮和「下载迁移报告」按钮；验证结果展示为 Stage 5 面板，逐项显示 ok/warning/error 状态
- **vendor/migrate-to-codex/**：内置 Codex 官方迁移 skill 完整副本（SKILL.md、references、scripts），作为同步逻辑的参考实现

---

## [1.1.1] — 2026-05-15

### 新增
- **Skills 管理 Tab**：Agent 配置页新增「Skills」标签页，展示全局/项目 skill 列表（名称、描述、来源标签），支持展开查看完整内容、编辑（⌘S 保存）、删除（确认弹窗）
- **Agents 管理 Tab**：Agent 配置页新增「Agents」标签页，展示子 Agent 列表（Claude `.md` / Codex `.toml`），显示 tools 元数据、格式标签，支持编辑和删除
- **MCP Servers Tab**：Agent 配置页新增「MCP」标签页，展示已配置的 MCP 服务器列表（来源文件、command、args、环境变量），支持展开查看详情
- **配置内容查看完整按钮**：配置文件详情页内容超过 2000 字符时，显示「查看完整内容」按钮展开全文
- **同步中心结构化转换说明**：展开同步项查看三类检测结果 — 斜杠命令引用（红）、工具名引用（橙）、需人工确认行（黄）
- **同步中心 diff 视图**：展开同步项可查看转换前后内容对比（红色删除/绿色新增，±3 行上下文）
- **系统托盘**：macOS 菜单栏图标 + 右键菜单（显示窗口 / 同步中心 / 退出），单击切换窗口显示

### 改进
- **同步中心按项选择**：转换计划阶段每行新增 checkbox，支持全选/反选/单项勾选，预演和执行仅处理选中项
- 同步后端 `analyzeContent()` 检测 Claude 斜杠命令和工具名引用，返回 `structured_warnings` 结构化字段
- 同步后端 `syncDryRun` / `syncExecute` 支持 `item_ids` 参数，实现文件粒度的按需同步

### 文档
- ROADMAP 全部 94 项完成（0 待执行）
- IMPLEMENTATION.md 补充完整配置定义表（Claude 13 项、Codex 11 项）、合并规则、同步机制说明

---

## [1.1.0] — 2026-05-14

### 重构
- 后端从独立 FastAPI 进程迁移至 Electron IPC：前端通过 `electronApi.backend()` 直接调用主进程，不再依赖 HTTP 代理或独立 Python 后端

### 修复
- `/meta` 无项目环境变量时返回 `null` 而非 home 目录，避免误设项目路径
- 强化打包后的 Electron 运行时稳定性

---

## [1.0.2] — 2026-05-12

### 修复
- Electron 打包后 API 请求 `Failed to fetch`：`file://` 协议下 `/api` 代理不存在，改为检测协议并直连 `http://127.0.0.1:8765`

---

## [1.0.0] — 2026-05-11

首个正式发布版本。

### 新增
- GitHub Actions CI：类型检查 + 前端构建 + macOS/Windows/Linux 三端 Electron 打包
- 项目选择器"上次使用"标注改为跟随前端切换记录实时更新，排版优化（来源标签移至路径行）

### 修复
- 默认项目路径恢复为用户 home 目录，同时 Electron 文件监听只监听 Claude/Codex 配置路径，避免递归监听整个 home。
- Electron 文件变动触发的后台刷新不再弹出“已刷新”成功 toast，并增加 300ms 防抖，避免刷新弹窗堆叠。
- 配置生效树：指令加载文案改为“全部拼接注入”，避免误导为覆盖关系。
- Codex resolved agents 扫描改为读取 `.toml` 文件，并在缺少 `tomllib/tomli` 时优雅降级。
- Claude resolved settings 对 `hooks` / `permissions` 使用多层追加合并，标记为“多层合并”。
- `/meta` 无项目环境变量时不再把 home 目录误设为当前项目。
- `/projects` 增加 `last_used` 并按最近使用排序；同路径 Claude/Codex 来源合并为 `both` 时保留最新时间。

### 改进
- ProjectSelector 首次无自动发现项目时显示引导文案，并为最近使用的发现项目标注“上次使用”。
- Help 新增“Claude Code 配置关系与优先级”章节；Agent 总览页移除静态关系树，配置生效树增加跳转入口。

---

## [Unreleased] — 2026-05-10

### 新增
- **图标多格式产物**
  - `assets/icon.icns`（1.7 MB，10 档 retina sizes，由 `iconutil` 生成）
  - `assets/icon.ico`（79 KB，6 档 16-256，由 PIL 生成）
  - `public/icon.svg`（矢量，作为深色/小尺寸 favicon 主源；PNG 仍作为兜底）
- electron-builder 三端图标分别指向 `.icns` / `.ico` / `.png`，打包时直出原生格式
- `index.html` favicon 链优先 SVG，回退 PNG

---

## [Unreleased] — 2026-05-09 (七)

### 新增
- **应用图标**：双弧 + 桥点（Claude 蓝 / Codex 绿，居中圆点 = steward）
- 落地：`public/icon.png` (favicon) + `assets/icon.png` (Electron BrowserWindow.icon)
- electron-builder：`build.mac/win/linux.icon` 指向 `assets/icon.png`

---

## [Unreleased] — 2026-05-09 (六)

### 改名
- 工具更名 `cct` → **`cc-steward`**（"Claude / Codex Steward"，配置管家）
- 涉及：`package.json` (name/appId/productName)、`index.html` 标题、TitleBar 主标 + 副标、Settings Project/Shortcuts/About 节、ZIP 导出文件名、`README.md` 重写、`backend/main.py` FastAPI 标题
- 环境变量：主名改为 `CC_STEWARD_PROJECT` / `CC_STEWARD_DEVTOOLS`，旧 `CCT_PROJECT` / `CCT_DEVTOOLS` 仍兼容
- 仓库目录路径暂未改名（`ClaudeCodex-Together`），后续可单独迁移

---

## [Unreleased] — 2026-05-09 (五)

### 修复
- Electron 重启的冷启动窗口期 vite 代理拿到 ECONNREFUSED → 前端误报 "API 500"。新增 `src/lib/retry.ts::withColdStartRetry`，识别网络/5xx 类错误并退避重试（最多 5 次，最长 2.5s）。useAgents/useAgentFiles/TitleBar/GlobalShortcuts 的刷新链路全部接入

---

## [Unreleased] — 2026-05-09 (四)

### 新增
- **⌘K 命令面板**：跨页面/文件/命令的全局搜索与跳转，支持 ↑↓ 选择 ↵ 执行 Esc 关闭
- **? 快捷键速查弹层**：随时按 `?` 调出全部快捷键
- **TitleBar 后端心跳指示灯**：每 5 秒探测 `/health`，绿/灰/红
- **Electron IPC 系统集成**：在 Finder 显示、在终端打开、原生目录选择器；FileDetail 路径行加按钮；Settings 项目页支持切换目录
- **深色模式**：浅 / 深 / 跟随系统三档（持久化），通过 CSS 变量驱动 token，过渡 200ms
- **安全写入**：后端文件写入与删除限制在 `~/.claude/` `~/.codex/` `~/.agents/` 与当前项目目录；越权返回 403
- **自动备份**：写入与删除前自动复制为 `.bak.<YYYYMMDD-HHMMSS>` 同目录文件
- **配置导出**：`GET /backup/export` 返回 ZIP（含 MANIFEST.txt 索引）；Settings → 备份与导出 一键下载

### 修复
- FileDetail "前往同步中心" 按钮真正跳转 `/sync`

---

## [Unreleased] — 2026-05-09 (三)

### 修复
- AgentConfigPage 外层缺 `flex-1 min-w-0`，导致宽窗口下右侧大片留白
- `OverviewTab` 用 `flex-1 overflow-auto`，但父级不是 flex 容器，`flex-1` 失效导致高度按内容撑开、永不触发滚动 → 改为 `h-full overflow-auto`
- 自定义滚动条加宽到 10px，颜色更明显（`#C7C7CC`，hover 变深），并补 Firefox 的 `scrollbar-width/scrollbar-color`，避免 macOS 默认隐藏式滚动条看不见的问题

---

## [Unreleased] — 2026-05-09 (二)

### 改动
- **新增模块**：`偏好`（Settings）— 左侧分区（外观/快捷键/运行环境/关于），TitleBar 偏好按钮接通；持久化的折叠侧栏开关；快捷键参考表；后端探测信息（含可一键复制路径）；版本与 GitHub 链接
- **Help 模块重构**：左侧锚点目录，IntersectionObserver 高亮当前章节；新增"当前环境"卡片、"键盘快捷键"参考、"已注册的 Agent"可点击跳转；卡片化每一节，hover 与过渡统一
- **共享层**：新增 `src/lib/shortcut-catalog.ts` 作为快捷键单一信源（Settings 与 Help 共用）

### 文档
- 合入 `DESIGN.md`（来自远程）
- `IMPLEMENTATION.md` 同步更新模块目录与共享层

---

## [Unreleased] — 2026-05-09

### 改动
- **架构**：抽 `useAgents` / `useAgentFiles` / `useShortcuts` hooks；新增 `components/ui/{Badges,Skeleton,Toast}` 共享层；store 增加 `loading/refreshing/error/toasts/sidebarCollapsed`，sidebar 状态持久化到 localStorage
- **交互**：全局 Toast 替代散落的 banner；快捷键 ⌘R 刷新、⌘B 折叠侧栏、⌘1/2/3 切换模块、`/` 聚焦搜索、编辑器 ⌘S/Esc；刷新按钮带 spin + disabled
- **布局**：侧栏可折叠到 58px 图标条；骨架屏（CardSkeleton / TableSkeleton）替代 "加载中…"；fade-in / toast-in 动画
- **视觉**：统一 `:focus-visible` 蓝色环；Electron 下隐藏自绘 traffic-light 让出原生位置；`drag-region` 整条标题栏可拖
- **数据通路**：移除 `src/core/mock-data.ts`（533 行）及 `isMockMode/probeBackend/FORCE_MOCK` 状态机；接口只走真实 backend，失败直接抛错由调用方 toast。修复一次探测失败即锁定 mock 的 Bug
- **基础设施**：dev 端口由 5173 改为 5174（与本机其他项目冲突）；`build:electron` 自动写入 `dist-electron/package.json` 标记 commonjs；DevTools 默认关闭，`CCT_DEVTOOLS=1` 启用并 detach 显示
- **App 启动**：`api.meta()` 加指数退避重试（300ms → 3s，最多 8 次），覆盖 Electron 冷启动期 backend 未就绪的窗口

### 已知问题 / 后续
- Electron 打包流程未验证（`npm run build` 仅在 dev 模式跑过）
- 同步中心暂未连接 FileDetail 的"前往同步中心"按钮跳转
- Settings/Help 模块只有占位

---

## [0.1.0] — 2026-05-08

初始版本。

### 功能
- 配置管理三级层次结构：Claude / Codex agent → 配置文件 → 文件详情
- 文件 CRUD：读、写、删除
- 同步中心：plan / dry-run / execute
- 文件对照表与配置关系树

### 模块
- Overview / 当前生效 / Claude / Codex / 同步中心 / 帮助 / 配置文件
- backend FastAPI + frontend React + Electron

详见提交 `42ef2d8` `317f3b8` `9186160` `7d128f9` `d4955b4`。
