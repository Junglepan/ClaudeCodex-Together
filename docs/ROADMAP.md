# CC Steward — 执行计划清单

> 本文档记录所有已规划但尚未执行的改进项。  
> 状态：`[ ]` 待执行 · `[~]` 进行中 · `[x]` 已完成

---

## 模块 A：Claude Agent 配置定义修正

> 对应文件：`src/agents/claude.ts` + `electron/backend/agents.ts`（v1.1.0 迁移至 Electron IPC 后端）

### A-1 补充缺失的配置文件条目

- [x] **A-1-1** 新增 `global_instructions` — `~/.claude/CLAUDE.md`（全局指令文件）
  - scope: global · kind: file · format: markdown
  - 与 `project_instructions` 对称，每次会话都注入
  - counterpart: codex `global_instructions`（`~/AGENTS.md`）
  - syncStrategy: 迁移：内容复制并清洗 Claude 专属语法

- [x] **A-1-2** 新增 `global_agents` — `~/.claude/agents/`（全局 Agent 目录）
  - scope: global · kind: dir · format: dir
  - 与 `project_agents` 对称，所有项目可用
  - counterpart: codex `global_agents`（`~/.codex/agents/`）
  - syncStrategy: 迁移：.md → .codex/agents/（frontmatter 适配）

- [x] **A-1-3** 新增 `global_commands` — `~/.claude/commands/`（用户级斜杠命令）
  - scope: global · kind: dir · format: dir
  - Claude Code 1.x 引入，单个 .md 文件即一个命令，`/<filename>` 调用
  - 区别于 skills（skills 需要 SKILL.md + 子目录结构）
  - 无直接 counterpart（Codex 无等价机制）

- [x] **A-1-4** 新增 `project_commands` — `.claude/commands/`（项目级斜杠命令）
  - scope: project · kind: dir · format: dir
  - 与 `global_commands` 对称，优先级高于全局同名命令
  - 无直接 counterpart

- [x] **A-1-5** 新增 `project_settings_local` — `.claude/settings.local.json`（本地覆盖层）
  - scope: project · kind: file · format: json
  - 官方支持的本地覆盖，不应提交到 git（.gitignore 排除）
  - 在配置合并优先级中位于 project settings 之上、CLI 参数之下
  - 无 counterpart

- [x] **A-1-6** 新增 `global_plugins` — `~/.claude/plugins/installed_plugins.json`（插件清单）
  - scope: global · kind: file · format: json · 只读（不提供编辑/删除）
  - 由 Claude Code 自动管理，展示已安装插件列表

### A-2 移除或重构不准确的条目

- [x] **A-2-1** 移除 `global_stop_hook`（`stop-hook-git-check.sh`）独立条目
  - 原因：Hook 脚本路径是用户自由决定的，硬编码具体路径在概念上是错误的
  - 替代方案：在 `global_settings`（settings.json）的详情页解析并可视化 `hooks` 字段
  - v1.1.0 已移除该条目，前后端均不再包含 `global_stop_hook`

---

## 模块 B：settings.json Hooks 字段可视化

> 依赖 A-2-1 完成后执行

- [x] **B-1** `FileDetail` 组件新增 Hooks 解析区块
  - `HooksSection` 组件按事件分组展示，显示 matcher、command、脚本路径、exists 状态
  - Electron 模式下支持"在 Finder 中显示"

- [x] **B-2** 后端 `/files/meta` 返回 parsed hooks 字段
  - `electron/backend/files.ts` 的 `parseHooks()` 解析 settings.json 中的 hooks 字段
  - 前端类型已包含 `parsed_hooks?: ParsedHook[]`

---

## 模块 C：配置关系树更新

> 依赖 A-1 完成后执行

- [x] **C-1** `ClaudeRelTree` 更新 settings.json 合并优先级图
  - 五层顺序已正确：内置默认值 → 全局用户配置 → 项目配置 → 项目本地覆盖 → 命令行参数
  - `settings.local.json` 作为独立层正确定位

- [x] **C-2** `ClaudeRelTree` 更新 CLAUDE.md 加载顺序图
  - 三层加载顺序：全局 `~/.claude/CLAUDE.md` → 项目根 → 子目录

- [x] **C-3** `ClaudeRelTree` 补充 commands/ 与 agents/ 作用域说明
  - `SCOPE_ITEMS` 包含全局/项目 Agents 和 Commands 共 5 项，并说明 Skills 与 Commands 区别

---

## 模块 D：概览页（Overview）重新设计

> **问题背景**
>
> 当前概览存在三个结构性问题：
> 1. Agent 卡片只显示"X 个文件存在 / Y 个未创建"——纯数字，无可操作性，用户不知道缺失的是什么、是否重要
> 2. 配置对照表使用"工作习惯层 / 基础设施层"等内部术语，绿点/灰点语义不足；对比的意义（是要同步？有差距？）从未说清楚
> 3. "当前生效"侧边栏页与概览内容高度重叠，两个页面说同一件事，分散理解
>
> **概览应回答的三个核心问题**
> 1. 我的配置健康吗？— 关键文件是否缺失
> 2. 当前项目是什么状态？— 有没有项目配置、配置了什么
> 3. 有什么需要关注的？— 差距在哪、可以做什么

### D-1 Agent 状态卡片重构（全局 + 项目分组）

- [x] **D-1-1** 卡片内部结构改为两段：全局层 + 项目层

  **目标视觉结构（双列并排）：**
  ```
  Claude Code                          Codex CLI
  ───────────────────────              ───────────────────────
  全局
  ✓ 指令    ~/.claude/CLAUDE.md        ✓ 指令    ~/.codex/AGENTS.md
  ✓ 技能    25 个 skills               ✗ 技能    未配置
  ✓ Agents  4 个                       ✓ Agents  4 个
  ✓ 设置    settings.json             ✓ 设置    config.toml
  ✓ 命令    12 个 commands             ─  (无等价机制)
  ───────────────────────              ───────────────────────
  当前项目: ClaudeCodex-Together        (来自 J 模块 projectPath)
  ✓ CLAUDE.md                          ✗ AGENTS.md   未同步
  ✓ .claude/agents/                    ✓ .codex/agents/
  ✗ .mcp.json                          ─
  ```

  - 全局层：固定展示全局指令 / 技能 / Agents / 设置 / 命令五类，每类对应最重要的那一个路径或数量
  - 项目层：仅当 `projectPath` 非 null 时展示；无项目时显示"未选择项目 — 点击顶部选择器选择"灰色提示
  - 状态语义：
    - `✓ 绿色`：文件/目录存在
    - `✗ 红色 + 标签`：不存在，标签说明影响（"未配置"、"未同步"、"建议创建"）
    - `─ 灰色`：该 agent 无此机制，不适用

- [x] **D-1-2** 去掉纯数字汇总行（"5 个文件已存在 / 3 个未创建"）
  - 替换为：如果有任何关键文件缺失，在卡片底部展示一条橙色警示行，如"⚠ 当前项目 AGENTS.md 未同步"
  - 如果全部关键文件存在，展示绿色"✓ 配置完整"

- [x] **D-1-3** 关键文件的定义（哪些缺失需要警告）
  - Claude 全局：`~/.claude/CLAUDE.md`、`~/.claude/settings.json`
  - Codex 全局：`~/.codex/AGENTS.md`、`~/.codex/config.toml`
  - 项目层（如果有项目）：`CLAUDE.md` 和 `AGENTS.md` 是配对文件，其中一个存在另一个不存在时，标注"未同步"
  - 非关键文件（技能/Agents/命令）：缺失时展示但不触发警告

### D-2 配置对照表重构（同步对齐视图）

- [x] **D-2-1** 移除"工作习惯层 / 基础设施层"分组标签
  - 改用用户能理解的分类：**指令 / 技能 / Agent / 设置 / 命令**
  - 每个分类行对应：该功能在 Claude 侧和 Codex 侧各自的文件/目录

- [x] **D-2-2** 对照表增加"同步状态"列，说明对比的语义
  - 列头：`功能` | `Claude` | `Codex` | `同步状态`
  - 同步状态取值：
    - `✓ 已对齐`：两侧都存在
    - `→ 可迁移`：仅 Claude 侧存在，内容可迁移到 Codex 侧
    - `← 待引入`：仅 Codex 侧存在，未同步到 Claude 侧
    - `✗ 均未配置`：两侧都不存在（不关键则灰色静默，关键则橙色提示）
    - `─ 仅适用于 Claude`：该功能 Codex 无等价机制
  - 这一列让用户理解"对比"的目的是检查 Claude ↔ Codex 配置是否对齐，而非仅展示存不存在

- [x] **D-2-3** 对照表新增 A-1 / I-2 模块补充的配置项
  - 加入 `global_instructions`（CLAUDE.md ↔ AGENTS.md）
  - 加入 `global_agents`（~/.claude/agents/ ↔ ~/.codex/agents/）
  - 加入 `global_commands`（~/.claude/commands/ — 仅 Claude，标"─"）
  - 去掉`stop_hook` 行（A-2-1 移除后同步删除）

### D-3 合并"当前生效"页面

- [x] **D-3-1** active-config 内容已在概览中覆盖
  - Overview 的 AgentCard 已展示全局+项目文件状态（exists/not exists），功能与 active-config 重叠
  - `activeConfigModule` 保持 `showInNav: false`，无任何入口链接指向它

- [x] **D-3-2** path-mapping 评估完成
  - 路径信息已在各 Agent 配置页的"配置明细"Tab 中完整展示
  - `pathMappingModule` 保持 `showInNav: false` 作为备用路由

### D-4 数据层对接（依赖 J 模块）

- [x] **D-4-1** 概览使用 `projectPath`（来自 Zustand store，J-2-1 新增）
  - 当 `projectPath` 为 null 时：项目层区域显示"未选择项目"占位提示，对照表只展示全局行
  - 当 `projectPath` 有值时：额外拉取该项目下的文件 meta，填充项目层状态

- [x] **D-4-2** 数据请求已优化
  - `useAgents` hook 通过 `Promise.all` 批量加载所有 agent summaries + file lists
  - 无需额外 batch 接口

---

## 模块 E：同步中心（Sync）体验重设计

> **问题背景**
>
> 后端逻辑已相当完整（扫描 → 转换 → 写入），但前端体验有三个结构性问题：
> 1. **执行前信息不透明**：用户点"执行"前看不到实际会影响哪些文件；`/sync/plan` 接口已返回逐项数据，但前端只在执行后才展示结果
> 2. **转换逻辑黑盒**：`converter.py` 做了清洗斜杠命令、工具名注释化、frontmatter 适配等有意义的转换，但前端 Notes 列只有一句结果，用户不知道改了什么、为什么标 check
> 3. **状态语义模糊**：`Added / Check before using / Not Added` 三种状态含义不精确——"Not Added"可能是"目标已存在跳过"也可能是"Codex 不支持此类型"，两种情况含义完全不同

### E-1 前端四阶段渐进流程

> 对应后端四个独立接口（见 E-4）。每个阶段结果留在页面，用户在每一步都能看到发生了什么。

- [x] **E-1-1** 页面加载自动触发第一阶段 `POST /sync/scan`（纯只读）
  - scan 无副作用，应主动呈现，不藏在按钮后面
  - 加载中展示骨架屏；后端不可达时展示"后端未运行"提示，不报错
  - scan 完成后展示"扫描结果面板"，出现"查看转换计划 →"按钮

- [x] **E-1-1b** 用户点击"查看转换计划"触发第二阶段 `POST /sync/plan`（scan + convert，不写）
  - plan 在 scan 结果下方叠加展示转换详情，原 scan 面板保持可见
  - plan 完成后"查看转换计划"按钮变为已完成态，出现"预演（Dry Run）→"按钮

- [x] **E-1-1c** 用户点击"预演"触发第三阶段 `POST /sync/dry-run`（scan + convert + write dry_run=True）
  - dry-run 在计划结果下方叠加展示每项目标文件的实际冲突检测结果
  - 此时状态标签从"待同步/有冲突"等静态状态变为"将写入/将跳过/将覆盖"等明确预期
  - dry-run 完成后出现"执行同步（N 项）"按钮

- [x] **E-1-1d** 用户点击"执行同步"触发第四阶段 `POST /sync/execute`（实际写入）
  - 执行结果追加展示，不覆盖前三阶段的面板（保留完整操作历史）

- [x] **E-1-2** 扫描结果面板逐项展示，每行包含：
  ```
  [类型徽章]  名称           源路径 → 目标路径        [状态标签]   [展开▾]
  skill       migrate-to-codex  ~/.claude/skills/...  →  ~/.codex/skills/...   待同步
  skill       review            ~/.claude/skills/...  →  ~/.codex/skills/...   已同步（跳过）
  agent       architect         ~/.claude/agents/...  →  ~/.codex/agents/...   有冲突
  instruction CLAUDE.md         ~/.claude/CLAUDE.md   →  ~/.codex/AGENTS.md   待同步
  hook        Stop              settings.json:hooks   →  ─                     不可迁移
  ```
  - 类型徽章：`skill` / `agent` / `instruction` / `hook` / `command`
  - 状态标签取值（替换原有 Added / Check / Not Added）：
    - `待同步`（绿色）：目标不存在，可以写入
    - `已同步`（灰色）：目标已存在且内容一致，本次会跳过
    - `有冲突`（橙色）：目标已存在但内容不同，默认跳过，覆盖模式下会覆盖
    - `需人工检查`（黄色）：converter 检测到工具名引用等无法自动处理的内容，写入后需用户确认
    - `不可迁移`（灰色）：Codex 不支持此类型（如 Stop Hook），不会写入

- [x] **E-1-3** 每行可展开"转换说明"抽屉
  - `StructuredWarningsPanel` 展示三类结构化信息：斜杠命令引用（红色）、工具名引用（橙色）、需确认行（黄色）
  - `ContentDiff` 展示转换前后内容对比
  - 展示 converter 的实际操作：
    ```
    ✂ 已删除 2 行（Claude 专属斜杠命令）：
        /compact → 已删除
        /clear   → 已删除

    🔧 工具列表已转为注释（Codex 不使用此字段）：
        # tools: Read, Write, Bash

    ⚠ 检测到工具名引用（需人工确认）：
        第 12 行: "使用 Bash 工具执行..."
    ```
  - 状态为"不可迁移"的行展开后说明原因："Codex 不支持 Stop 事件，hooks 无法迁移"
  - 无转换操作的项（内容直接复制）展开后显示"内容直接复制，无需转换"

### E-2 操作区重构

- [x] **E-2-1** 范围选择保留（全部 / 仅全局 / 仅当前项目），与 J 模块 `projectPath` 联动
  - 已实现：三按钮切换 + `projectPath` 为空时提示"请先选择项目"

- [x] **E-2-2** 新增"覆盖模式"开关（默认关闭）
  - 关闭时：`有冲突` 状态的文件跳过
  - 开启时：`有冲突` 状态的文件强制覆盖（原文件自动备份为 `.bak.<ts>`）
  - 开启后在扫描面板中将`有冲突`项的标签更新为`将覆盖`（橙色加粗），提升感知

- [x] **E-2-3** 执行按钮状态
  - 扫描中：禁用，显示"扫描中..."
  - 扫描完成无可同步项：禁用，显示"无需同步"
  - 有待同步或待覆盖项：启用，显示"执行同步（N 项）"

### E-3 执行报告重构

- [x] **E-3-1** 执行后结果按状态分组展示
  - 分组：`已写入（N）` / `已跳过（N）` / `失败（N）`（失败组折叠默认展开）
  - 移除原有英文状态列，改为中文状态徽章

- [x] **E-3-2** 每项可展开查看转换前后 diff
  - 后端 `syncPlan/syncDryRun/syncExecute` 返回 `source_content` 和 `target_content`
  - 前端 `ContentDiff` 组件展示变更行（红色删除/绿色新增）± 3 行上下文
  - 内容无变更时显示"内容直接复制，无需转换"

### E-4 后端：拆分 sync 路由为四个独立接口

> **核心判断**：后端 `scan_global/project()`、`convert_*()`、`write_files(dry_run)` 四类函数已存在且职责分离。
> 问题在于 `_build_plan` 把这四步混在一起，两个路由（`/sync/plan`、`/sync/execute`）把所有阶段耦合了，
> 前端拿到的数据无法区分"扫描到了什么"和"转换后是什么"和"预计写入什么"。
> 改动量小：函数本身不动，只拆路由。

- [x] **E-4-1** 拆分 sync 后端，将 `_build_plan` 逻辑拆成四个接口
  - Electron IPC 后端已提供 `sync.scan` / `sync.plan` / `sync.dryRun` / `sync.execute`。

  | 接口 | 调用逻辑 | 返回 |
  |------|----------|------|
  | `POST /sync/scan` | 只调用 `scanner.scan_global()` / `scan_project()` | 每项的类型、名称、源路径、原始内容摘要（不转换） |
  | `POST /sync/plan` | scan + `converter.convert_*()` | scan 结果 + 目标路径 + 转换状态 + `warnings`（删了哪些行） |
  | `POST /sync/dry-run` | scan + convert + `write_files(dry_run=True)` | plan 结果 + 每项目标文件是否已存在、将跳过/写入/覆盖 |
  | `POST /sync/execute` | scan + convert + `write_files(dry_run=False)` | 实际写入报告（写入成功/跳过/失败） |

  - 四个接口共享相同的 request body（scope、project、overwrite）
  - `POST /sync/plan` 和 `POST /sync/dry-run` 保持幂等（无副作用）
  - 现有 `GET /sync/plan` 和 `POST /sync/execute` 路由可先保留做兼容，标记 deprecated

- [x] **E-4-2** `/sync/plan` 响应透传结构化 warnings 字段
  - `analyzeContent()` 检测斜杠命令引用和工具名引用，生成 `{ removed_lines, tool_comments, check_lines }`
  - 通过 `structured_warnings` 字段返回，前端 `StructuredWarningsPanel` 渲染
  - `converter.py` 已记录 warnings（删除的斜杠命令行、工具名引用检测结果），但当前路由响应将其丢弃
  - 改动：在 `_build_plan` / plan 路由的序列化处将 `warnings` 字段包含进响应体
  - 响应结构（每项）：
    ```json
    {
      "type": "skill",
      "name": "review",
      "source_path": "~/.claude/skills/review/SKILL.md",
      "target_path": "~/.codex/skills/review/SKILL.md",
      "status": "pending",
      "warnings": {
        "removed_lines": ["/compact", "/clear"],
        "tool_comments": ["Read", "Write", "Bash"],
        "check_lines": [{"line": 12, "content": "使用 Bash 工具执行..."}]
      }
    }
    ```
  - 前端用 `warnings` 填充 E-1-3 展开抽屉内容（这是唯一需要补充的字段，其余逻辑不变）

- [x] **E-4-3** `settings.local.json` 不在同步范围内
  - sync.ts 的 `scan()` 只扫描 instructions/skills/agents/commands，settings 文件天然排除
  - 无需额外排除规则

- [x] **E-4-4** 新增 `global_instructions`、`global_agents`、`global_commands` 同步规则
  - `global_instructions`（CLAUDE.md → AGENTS.md）：加入 scan 范围，走 instruction converter
  - `global_agents`（~/.claude/agents/ → ~/.codex/agents/）：加入 scan 范围，走 agent converter
  - `global_commands`（~/.claude/commands/）：scan 到后状态固定为 `unsupported`，notes 说明"Codex 无等价斜杠命令机制"

---

## 模块 F：后端同步更新

> v1.1.0 后端从 Python FastAPI 迁移至 Electron IPC（`electron/backend/`），以下条目均已在新架构中实现。

- [x] **F-1** 后端 agent 定义与前端保持一致
  - `electron/backend/agents.ts` 的 `claudeSpecs`（13 条）和 `codexSpecs`（11 条）与前端完全同步
  - 已移除 `global_stop_hook` 条目

- [x] **F-2** 扫描范围已覆盖新增目录
  - `electron/backend/sync.ts` 的 `scan()` 已覆盖 instructions、skills、agents、commands 目录

- [x] **F-3** sync 路由已拆分为四个独立接口
  - `syncScan` / `syncPlan` / `syncDryRun` / `syncExecute` 在 `electron/backend/sync.ts` 中实现
  - 通过 `electron/backend/api.ts` 注册为 IPC 端点

---

## 模块 I：Codex Agent 配置定义修正

> 对应文件：`src/agents/codex.ts` + `electron/backend/agents.ts`（v1.1.0 迁移至 Electron IPC 后端）

### I-1 错误修正（必须执行）

- [x] **I-1-1** 修正全局 AGENTS.md 路径
  - 已修正为：`pathTemplate: '{home}/.codex/AGENTS.md'`
  - 前后端 `codexSpecs` 均已同步

- [x] **I-1-2** 修正 agents 目录的格式描述
  - 已更新：Codex agents 支持 `.toml` 格式
  - `global_agents` 和 `project_agents` 两条目的 `details` 已更新

- [x] **I-1-3** 重新定位 `~/.agents/skills/` 和 `{project}/.agents/skills/`
  - 已从 Codex configFiles 中移除旧的 `.agents/` 中转路径
  - skills 改为引用 Codex 原生路径 `~/.codex/skills/`

### I-2 补充缺失条目（高价值）

- [x] **I-2-1** 新增 `global_skills` — `~/.codex/skills/`（Codex 原生 skills）
  - scope: global · kind: dir · format: dir
  - Codex 原生 skill 体系的实际存储路径（区别于迁移中转路径 `~/.agents/skills/`）
  - 本机有 doc、pdf、sora、codex-primary-runtime 等实际内容
  - 无直接 counterpart（Claude skills 在 `~/.claude/skills/`，路径和加载机制不同）

- [x] **I-2-2** 新增 `global_memories` — `~/.codex/memories/`（记忆系统）
  - scope: global · kind: dir · format: dir · 只读展示
  - Codex 独有功能，Claude 无对应机制
  - 需在 `config.toml` 中启用：`[features] memories = true`
  - 目录内包含：`MEMORY.md`、`raw_memories.md`、`memory_summary.md`
  - 展示时注明启用条件；未启用则显示"此功能未开启"

- [x] **I-2-3** 新增 `global_auth` — `~/.codex/auth.json`（认证文件）
  - scope: global · kind: file · format: json · 只读（不提供编辑/删除）
  - 等价于 Claude 的 `.claude.json`，存储 API key 和 token
  - 详情页标注"由 Codex 自动管理，不建议手动编辑"

### I-3 补充说明（中等价值，在现有条目详情里增加）

- [x] **I-3-1** `global_config`（config.toml）详情页补充 `[projects]` 字段说明
  - 已在 `details` 字段中补充 `[projects]` 段的 `trust_level` 说明

---

## 模块 H：配置生效树 Tab（AgentConfigPage 第三个 Tab）

> 新信息维度：展示各配置维度合并后的实际生效状态，回答"最终哪一层在生效、覆盖关系如何"。  
> 依赖 A-1、F-1、F-2 完成后执行。

### H-1 总览 Tab 减负

- [x] **H-1-1** 将 `ClaudeRelTree`（静态配置关系知识）从总览 Tab 移除
  - 已移入帮助页 `Help.tsx`，总览 Tab 不再包含静态关系树

- [x] **H-1-2** 配置生效树 Tab 顶部放静态知识入口
  - `ResolvedConfigTab` 顶部已有"查看配置合并原理 →"链接，跳转 `/help#config-mechanism`

### H-2 后端新增 resolved 接口

- [x] **H-2-1** 新增 `GET /config/resolved?agent=claude&project=...`
  - 返回各配置维度的合并态，结构如下：
    ```json
    {
      "settings": [
        { "key": "model", "value": "...", "source": "project", "overrides": "global" },
        { "key": "hooks", "value": [...], "source": "merged", "layers": ["global", "project"] }
      ],
      "instructions": [
        { "path": "~/.claude/CLAUDE.md", "exists": true, "order": 1 },
        { "path": "./CLAUDE.md", "exists": true, "order": 2 }
      ],
      "skills": [
        { "name": "migrate-to-codex", "source": "global", "overridden_by": null },
        { "name": "review", "source": "global", "overridden_by": "project" }
      ],
      "agents": [
        { "name": "architect", "source": "global", "overridden_by": null }
      ]
    }
    ```
  - settings 第一版只展示顶层 key，不展开嵌套对象（控制复杂度）
  - hooks/permissions 等数组字段标注为"多层合并追加"，不拆解每个元素的来源

### H-3 前端：配置生效树 Tab 组件

- [x] **H-3-1** `AgentConfigPage` 新增第三个 Tab：`配置生效树`
  - Tab 顺序：总览 / 配置明细 / **配置生效树**，已实现

- [x] **H-3-2** `ResolvedConfigTab` 组件，包含四个子区块：
  - 设置合并结果（顶层 key + 来源层徽章 + 覆盖链）
  - 指令加载顺序（序号 + 路径 + exists 状态）
  - Skills 覆盖关系（来源 + 项目覆盖标注）
  - Agents 覆盖关系（与 Skills 展示形式相同）

- [x] **H-3-3** 加载态与空态处理
  - 加载中：骨架屏；错误时显示错误详情面板

---

## 模块 G：DESIGN.md 文档同步更新

- [x] **G-1** 更新 Claude 配置关系树章节，补充新增文件
  - `IMPLEMENTATION.md` 新增完整的 Claude（13 项）和 Codex（11 项）配置定义表
- [x] **G-2** 更新"后续扩展方向"表格，将已规划项标记为 In-Plan
  - ROADMAP.md 中所有已实现项已更新为 `[x]`
- [x] **G-3** 补充 commands/ 与 agents/ 两级作用域的说明
  - `IMPLEMENTATION.md` 新增配置合并规则和作用域说明

---

## 模块 J：项目路径选择（Project Context Selector）

> 当前所有 API 调用都可以接受 `?project=<path>` 参数，但前端没有提供选择当前工作项目的入口。  
> 本模块为 cc-steward 提供"当前项目上下文"，让配置明细、生效树等视图都基于所选项目展示。

### J-1 后端：项目列表接口

- [x] **J-1-1** 新增 projects 端点
  - `electron/backend/projects.ts` 实现 `listProjects()`，扫描 Claude/Codex 两侧项目目录
  - 通过 `electron/backend/api.ts` 注册为 `projects.list` IPC 端点

- [x] **J-1-2** 路由已注册到 Electron IPC 后端

### J-2 前端：Zustand Store 扩展

- [x] **J-2-1** `src/store/index.ts` 包含 `projectPath` 字段
  - 初始值 `undefined`（meta 未加载），`setProjectPath` action 已实现
  - 已加入 `persist` 的 `PERSISTED_KEYS`，含 `recentProjects` 追踪

- [x] **J-2-2** 项目列表直接在 `ProjectSelector` 组件中通过 `api.projects.list()` 获取

### J-3 前端：TitleBar 项目选择器

- [x] **J-3-1** `ProjectSelector` 组件已实现
  - TitleBar 内嵌项目选择器，显示目录名 + source 徽章 + 上次使用标注
  - 下拉面板包含最近使用项目列表

- [x] **J-3-2** "浏览其他目录..." 交互
  - Electron 模式调用 `electronApi.openDirectoryDialog()` 系统选择器
  - 选中后 `setProjectPath` 并更新 `recentProjects`

### J-4 前端：projectPath 透传至所有 API 调用

- [x] **J-4-1** API 调用已透传 `projectPath`
  - `useAgentFiles` hook 从 store 读取 `projectPath` 并传递给 API

- [x] **J-4-2** 配置生效树 Tab 已透传 `project`
  - `ResolvedConfigTab` 从 store 读取 `projectPath` 传入 `api.config.resolved()`

### J-5 Electron 主进程：目录选择 IPC

- [x] **J-5-1** IPC handler 已注册
  - `electron/main.ts` 注册 `dialog:openDirectory`
  - `electron/preload.ts` 暴露 `openDirectoryDialog`

---

## 模块 K：Electron 桌面集成深化

> 当前 Electron 集成已有基础（IPC bridge、preload、基本窗口管理），但缺少两个对 macOS 桌面应用体验至关重要的功能：原生菜单和文件变动监听。其余方向（托盘、右键菜单、状态恢复、自动更新）按价值分层，可按需执行。

### K-1 原生应用菜单（高优先级，macOS 基本素养）

- [x] **K-1-1** 在 `electron/main.ts` 中使用 `Menu.buildFromTemplate` 注册应用菜单
  - 原生菜单已注册：文件（切换项目）、编辑（标准系统快捷键）、视图（刷新/侧栏/主题/全屏）、窗口、帮助（帮助/同步/偏好/GitHub）

  **菜单结构：**
  ```
  文件
    切换项目...          ⌘O   → 触发 J-3 项目选择器（发送 IPC 事件到 renderer）
    导出当前配置...             → 调用 dialog.showSaveDialog，将选中文件内容写出
    ──────
    退出                 ⌘Q

  编辑
    撤销                 ⌘Z   → 标准 role: 'undo'（不需要自定义）
    重做                 ⇧⌘Z  → role: 'redo'
    ──────
    剪切                 ⌘X   → role: 'cut'
    复制                 ⌘C   → role: 'copy'
    粘贴                 ⌘V   → role: 'paste'
    全选                 ⌘A   → role: 'selectAll'
    （注：不加编辑菜单，文本框右键菜单在 macOS 上不工作）

  视图
    刷新                 ⌘R   → webContents.reload()
    切换深色模式         ⇧⌘D  → 发 IPC 事件 'app:toggle-theme' 到 renderer
    折叠/展开侧栏        ⌘B   → 发 IPC 事件 'app:toggle-sidebar' 到 renderer
    ──────
    开发者工具           ⌥⌘I  → webContents.toggleDevTools()（仅 dev 模式）

  帮助
    快捷键参考                 → 打开 help 页面（发 IPC 事件 'app:navigate' to '/help'）
    在 GitHub 查看             → shell.openExternal('https://github.com/...')
    关于 cc-steward            → role: 'about'（macOS）
  ```

  - 编辑菜单使用内置 `role` 即可，Electron 自动处理，不需要自定义逻辑
  - "切换项目"、"切换深色模式"、"折叠侧栏"、"导航到帮助页"等需要 renderer 响应的菜单项，通过 `mainWindow.webContents.send(event)` 推送；renderer 在 `electron-bridge.ts` 中监听对应事件并调用 store/router

- [x] **K-1-2** renderer 侧注册菜单 IPC 监听
  - 在 `src/lib/electron-bridge.ts`（或 App.tsx 顶层）监听：
    - `app:toggle-theme` → 调用 `useAppStore.getState().setTheme(...)`
    - `app:toggle-sidebar` → 调用 `useAppStore.getState().setSidebarCollapsed(...)`
    - `app:navigate` → 调用 React Router 的 `navigate(path)`
  - 确保监听在组件 unmount 时正确移除（`ipcRenderer.removeListener`）

### K-2 文件变动监听（高优先级，解决数据过期问题）

> 用户在外部编辑配置文件（VS Code / vim）后，cc-steward 无感知，展示的是过期数据。

- [x] **K-2-1** 在 `electron/main.ts` 中维护 `fs.watch` 监听集合

  **监听目标：**
  - 始终监听：`~/.claude/`（递归）、`~/.codex/`（递归）
  - 有选中项目时动态添加：`<projectPath>/.claude/`、`<projectPath>/CLAUDE.md`、`<projectPath>/AGENTS.md`

  **实现要点：**
  ```typescript
  // 使用 chokidar（如已在依赖中）或原生 fs.watch
  // 推荐 chokidar：稳定跨平台，支持递归，有防抖
  import chokidar from 'chokidar'

  let watcher: chokidar.FSWatcher | null = null

  function startWatching(paths: string[]) {
    watcher?.close()
    watcher = chokidar.watch(paths, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300 },  // 防抖：文件写完再通知
    })
    watcher.on('all', (event, filePath) => {
      mainWindow?.webContents.send('fs:changed', { event, path: filePath })
    })
  }
  ```

  - 项目路径变更时（renderer 发送 `app:set-project`），主进程重新调用 `startWatching`
  - 应用退出时 `watcher?.close()`

- [x] **K-2-2** renderer 侧响应 `fs:changed` 事件触发数据刷新
  - 在 `src/lib/electron-bridge.ts` 暴露 `onFsChanged(callback)` 订阅函数
  - 各数据 hook（`useAgentFiles`、`useAgentStatus`、`useProjects`）在 Electron 模式下注册此监听，收到事件后调用 `refetch()`
  - 刷新时不重置页面状态（不清空选中的文件），静默后台刷新
  - 对同一文件的高频变更做 300ms 防抖（由 chokidar `awaitWriteFinish` 处理，renderer 无需额外处理）

- [x] **K-2-3** 确认 `chokidar` 依赖
  - 当前实现使用原生 `fs.watch`，未新增运行时依赖。
  - 检查 `package.json` 中是否已有 `chokidar`（Vite/Electron 工具链常带此依赖）
  - 若无则 `npm install chokidar`，确保其在 `dependencies`（非 devDependencies）中，以便打包进 Electron

### K-3 原生右键菜单（中等优先级）

- [x] **K-3-1** 文件树节点右键弹出 contextMenu
  - `FileGroup` 组件已实现 `handleContextMenu`，支持查看详情/在 Finder 中显示/在终端中打开/复制路径
  - 在 renderer 通过 `ipcRenderer.invoke('context-menu:file', { path, exists })` 请求主进程弹出菜单
  - 主进程用 `Menu.buildFromTemplate` + `menu.popup()` 弹出，菜单项：
    - 在 Finder 中显示（`shell.showItemInFolder(path)`）
    - 在终端打开（`shell.openPath(path)` 或 `open -a Terminal <dir>`）
    - 复制路径（`clipboard.writeText(path)`）
    - ──────
    - 编辑（`ipcRenderer.send('navigate:file-detail', { path })`）
    - 删除（弹确认对话框后调用现有 DELETE 接口）
  - 非 Electron 模式下右键菜单不注册，FileDetail 面板的按钮保留作为降级方案

### K-4 状态恢复（中等优先级）

- [x] **K-4-1** `projectPath` 已纳入 Zustand persist
  - `PERSISTED_KEYS` 包含 `sidebarCollapsed`、`theme`、`recentProjects`、`projectPath`
  - `selectedFile` 不持久化（每次启动从总览开始更合理）
  - 目前只有 `sidebarCollapsed` 和 `theme` 写了 localStorage
  - 使用 Zustand `persist` middleware 的 `partialize` 选项，只持久化需要恢复的字段
  - 重启后 `projectPath` 恢复 → 触发 K-2-1 的 `app:set-project` → 主进程重启文件监听

### K-5 系统托盘（低优先级）

- [x] **K-5-1** 系统托盘已实现
  - macOS 模板图标 + 右键菜单：显示窗口 / 同步中心 / 退出
  - 单击切换窗口显示/隐藏
  - 实现条件：K-1 和 J 模块完成后，托盘菜单复用相同的 IPC 事件集

---

## 执行顺序建议

```
A-1（Claude 补充条目）+ A-2（移除错误条目）
I-1（Codex 错误修正）  + I-2（Codex 补充条目）
          ↓
    ┌─────┴──────┬──────────────┐
    F（后端同步）  C（关系树更新）  B（hooks 可视化）
    ↓             ↓
    H-2（resolved 接口）
    ↓
    H-1（总览减负）+ H-3（生效树 Tab）
    ↓
    D（概览改进）    E（同步规则）    I-3（config.toml 详情补充）
          ↓
      G（文档更新）

J（项目路径选择）可独立并行，不依赖 A~I
  J-1（后端 /projects）→ J-2（Store）→ J-3（TitleBar UI）→ J-4（透传）+ J-5（Electron IPC）

K（Electron 桌面集成）可独立并行，K-2 依赖 J-2（projectPath store）
  K-1（原生菜单）独立可做
  K-2（文件监听）→ 依赖 J-2 完成后（projectPath 可用）
  K-3（右键菜单）独立可做，FileDetail 面板作降级方案
  K-4（状态恢复）→ 依赖 J-2 完成后
  K-5（托盘）→ 依赖 K-1 + J 完成后
```

---

*最后更新：2026-05-15*

---

## 模块 Q：规范符合度修正（官方行为对齐）

> 来源：对当前实现与 Claude Code / Codex CLI 官方规范的逐项比对。  
> 三类问题：说明文字误导、文件格式识别错误、数组字段合并逻辑错误。

### Q-1 指令加载描述文字修正（低风险）

> 影响文件：`src/modules/agent-config/ResolvedConfigTab.tsx`

**根因**：CLAUDE.md / AGENTS.md 的实际行为是所有层级**全部拼接注入**上下文，不存在"后者覆盖前者"的关系。当前两处文字描述均有误导。

- [x] **Q-1-1** 修正 `InstructionsSection` 的 `hint` 文字（第 130 行）
  ```
  旧：hint="Markdown 指令文件按优先级依次注入，后者可覆盖前者"
  新：hint="所有层级全部拼接注入，全局与项目指令同时生效，不存在覆盖"
  ```

- [x] **Q-1-2** 修正页面顶部描述（第 46 行）
  ```
  旧："当前实际生效的配置合并结果，按优先级从低到高展示覆盖关系"
  新："当前实际生效的配置合并结果：settings 字段后者覆盖前者，指令文件全部拼接"
  ```

---

### Q-2 Codex agents 文件格式修正（低风险）

> 影响文件：`backend/api/routers/config.py`

**根因**：`_resolve_codex` 函数扫描 `~/.codex/agents/` 时用 `.endswith(".md")` 过滤，但 Codex agent 文件格式为 `.toml`，导致发现结果永远为空。

- [x] **Q-2-1** 修正 `_resolve_codex` 中 agents 目录的扫描后缀（第 206-207 行）
  ```python
  # 旧（错误）
  global_agent_names  = {p[:-3] for p in _dir_entries(global_agents_dir)  if p.endswith(".md")}
  project_agent_names = {p[:-3] for p in _dir_entries(project_agents_dir) if p.endswith(".md")} ...

  # 新（正确）
  global_agent_names  = {p[:-5] for p in _dir_entries(global_agents_dir)  if p.endswith(".toml")}
  project_agent_names = {p[:-5] for p in _dir_entries(project_agents_dir) if p.endswith(".toml")} ...
  ```
  注：Claude agents 侧（第 116-117 行）保持 `.md` + `[:-3]` 不变。

---

### Q-3 settings 数组字段追加合并（中风险）

> 影响文件：`backend/api/routers/config.py`、`src/core/api.ts`、`src/modules/agent-config/ResolvedConfigTab.tsx`

**根因**：当前 `_resolve_claude` 对所有 key 统一使用 last-wins 覆盖。官方规范中 `hooks`、`permissions` 字段是**各层追加合并**（全局 hooks 列表 + 项目 hooks 列表 = 最终列表），标量字段才是后者覆盖前者。

#### Q-3-1 后端：按字段类型分支处理

- [x] 已实现：`hooks` / `permissions` 按层追加，来源显示为 `merged`。

修改 `_resolve_claude` 的 settings 合并逻辑：

```python
ARRAY_MERGE_KEYS = {"hooks", "permissions"}

layers = [
    ("global",        global_data),
    ("project",       project_data),
    ("local_override", local_data),
]

settings_rows = []
all_keys = set(global_data) | set(project_data) | set(local_data)
for key in sorted(all_keys):
    layers_with_key = [(src, data[key]) for src, data in layers if key in data]

    if key in ARRAY_MERGE_KEYS:
        # 数组字段：各层拼接，source 标为 "merged"
        merged = []
        for _, val in layers_with_key:
            if isinstance(val, list):
                merged.extend(val)
        value      = merged
        source     = "merged" if len(layers_with_key) > 1 else layers_with_key[0][0]
        overrides  = []  # 追加不是覆盖，无需标 overrides
    else:
        # 标量字段：last-wins（现有逻辑）
        sources = [src for src, _ in layers_with_key]
        value   = layers_with_key[-1][1]
        source  = sources[-1]
        overrides = sources[:-1] if len(sources) > 1 else []

    val_str = json.dumps(value, ensure_ascii=False)
    if len(val_str) > 80:
        val_str = val_str[:77] + "…"
    settings_rows.append({
        "key":      key,
        "value":    val_str,
        "source":   source,
        "overrides": overrides,
    })
```

#### Q-3-2 前端类型：`source` 补充 `'merged'`

- [x] 已实现：`ResolvedSettingsRow.source` 支持 `merged`。

修改 `src/core/api.ts` 中 `ResolvedSettingsRow`：

```typescript
// 旧
source: 'global' | 'project' | 'local_override'

// 新
source: 'global' | 'project' | 'local_override' | 'merged'
```

#### Q-3-3 前端 UI：`SourceBadge` 加 `merged` 分支

- [x] 已实现：`SourceBadge` 展示“多层合并”。

修改 `src/modules/agent-config/ResolvedConfigTab.tsx` 中 `SourceBadge`：

```typescript
const map = {
  global:         { label: '全局',     cls: 'bg-accent-blue/10 text-accent-blue' },
  project:        { label: '项目',     cls: 'bg-accent-green/10 text-accent-green' },
  local_override: { label: '本地覆盖', cls: 'bg-accent-orange/10 text-accent-orange' },
  merged:         { label: '多层合并', cls: 'bg-purple-100 text-purple-700' },
}
```

合并后的 hooks / permissions 行展示效果：
```
键            生效值                      来源
────────────────────────────────────────────────────
hooks         [{"event":"Stop",...}, ...]  [多层合并]
permissions   ["Bash","Read","Write"]      [多层合并]
model         "claude-opus-4-5"            [项目] → 全局
```

---

### Q-3 实施顺序

```
第一批（无逻辑风险，直接做）
  Q-1-1 + Q-1-2  hint 文字修正
  Q-2-1           Codex agents 后缀

第二批（后端逻辑变更，需验证）
  Q-3-1           后端数组合并（建议手动测试：构造含 hooks 的 global+project settings.json，
                  验证 merged 结果长度 = 两层之和，顺序为全局在前）
  Q-3-2           前端类型补充
  Q-3-3           SourceBadge UI
```

---

## 模块 P：项目发现体验完善

> 来源：J-1 后端接口实现后的体验后续——初次打开为空、排序无依据、默认项目语义需统一。

### P-1 /meta 默认项目语义

> 影响文件：`backend/main.py`、`src/App.tsx`

**产品决策更新（2026-05-15）**：当前无 env var 时 `/meta` 回退到 home 目录是可接受行为。cc-steward 将 `~` 视为合法默认项目上下文，而不是空项目选择。

- [x] **P-1-1** `/meta` 无 env var 时 `project_path` 返回 home 目录，避免启动后没有可用项目上下文

- [x] **P-1-2** 前端将返回的 home 目录作为当前项目；`projectPath` 初始 `undefined` 仅表示 meta 尚未加载。

---

### P-2 /projects 加 last_used 排序依据

> 影响文件：`backend/api/routers/projects.py`

**根因**：当前 `/projects` 返回列表只按 `exists`、`name` 排序，用户最近使用的项目不一定排在最前。

- [x] **P-2-1** Claude 侧：取 `~/.claude/projects/<dir>` 的 `mtime` 作为 `last_used`
  ```python
  last_used = entry.stat().st_mtime  # Unix timestamp
  ```

- [x] **P-2-2** Codex 侧：暂设 `last_used = None`（config.toml 不记录访问时间）

- [x] **P-2-3** 合并结果按 `last_used` 降序排列，`None` 排末尾；同路径 claude+codex 取较大值

- [x] **P-2-4** 响应结构加 `last_used` 字段，前端 `ApiProject` 接口同步更新
  ```typescript
  export interface ApiProject {
    path: string
    name: string
    exists: boolean
    source: 'claude' | 'codex' | 'both'
    last_used: number | null  // Unix timestamp，null 表示未知
  }
  ```

---

### P-3 ProjectSelector 初次使用引导

> 影响文件：`src/components/ui/ProjectSelector.tsx`

**根因**：首次使用时 `discovered` 为空（后端暂未发现任何项目），下拉面板只有"选择文件夹"按钮，无任何引导。

- [x] **P-3-1** 无发现结果且无 recents 时，显示引导文案
  ```
  未自动发现项目
  请点击"选择文件夹"指定项目目录，
  或确保已使用过 Claude Code / Codex CLI。
  ```

- [x] **P-3-2** 有发现结果时，`last_used` 最近的项目加"上次使用"标签（非自动切换，只是视觉提示）
  ```
  已识别项目
  ● my-project    [Claude+Codex]  上次使用 ←
  ● api-server    [Claude]
  ```

---

## 模块 H-1：ClaudeRelTree 静态知识迁移

> 当前状态：ClaudeRelTree 仍在 AgentConfigPage OverviewTab（第 172 行），总览 Tab 混合了状态数据与静态知识。

- [x] **H-1-1** 帮助页新增"配置机制"章节
  - 在 `src/modules/help/Help.tsx` 现有章节后增加 section，标题"Claude Code 配置关系与优先级"
  - 直接渲染 `<ClaudeRelTree />`，或将其内容展开为帮助页风格静态说明块

- [x] **H-1-2** AgentConfigPage OverviewTab 移除 ClaudeRelTree
  - 删除 `agentId === 'claude'` 下的 ClaudeRelTree 整个卡片（约 12 行）
  - OverviewTab 回归纯状态快照：统计卡片 + 文件状态列表

- [x] **H-1-3** ResolvedConfigTab 顶部加静态知识入口
  - 在页面右上角加 `查看配置合并原理 →` 链接，`navigate('/help')` 并带锚点 `#config-mechanism`

---

## 新模块执行顺序建议

```
Q-1 + Q-2（纯文字 + 2 行改动，零风险，优先做）
     ↓
Q-3（后端逻辑 → 前端类型 → UI，按顺序，中等风险）
     ↓
P-1（/meta null 回退，影响首次体验，尽早做）
P-3（ProjectSelector 引导，依赖 P-1 完成后验证）
     ↓
P-2（/projects 排序，锦上添花，低优先）
     ↓
H-1（ClaudeRelTree 迁移，独立，随时可做）
```
