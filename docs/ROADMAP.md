# CC Steward — 执行计划清单

> 本文档记录所有已规划但尚未执行的改进项。  
> 状态：`[ ]` 待执行 · `[~]` 进行中 · `[x]` 已完成

---

## 模块 A：Claude Agent 配置定义修正

> 对应文件：`src/agents/claude.ts` + `backend/core/agents/claude.py`

### A-1 补充缺失的配置文件条目

- [ ] **A-1-1** 新增 `global_instructions` — `~/.claude/CLAUDE.md`（全局指令文件）
  - scope: global · kind: file · format: markdown
  - 与 `project_instructions` 对称，每次会话都注入
  - counterpart: codex `global_instructions`（`~/AGENTS.md`）
  - syncStrategy: 迁移：内容复制并清洗 Claude 专属语法

- [ ] **A-1-2** 新增 `global_agents` — `~/.claude/agents/`（全局 Agent 目录）
  - scope: global · kind: dir · format: dir
  - 与 `project_agents` 对称，所有项目可用
  - counterpart: codex `global_agents`（`~/.codex/agents/`）
  - syncStrategy: 迁移：.md → .codex/agents/（frontmatter 适配）

- [ ] **A-1-3** 新增 `global_commands` — `~/.claude/commands/`（用户级斜杠命令）
  - scope: global · kind: dir · format: dir
  - Claude Code 1.x 引入，单个 .md 文件即一个命令，`/<filename>` 调用
  - 区别于 skills（skills 需要 SKILL.md + 子目录结构）
  - 无直接 counterpart（Codex 无等价机制）

- [ ] **A-1-4** 新增 `project_commands` — `.claude/commands/`（项目级斜杠命令）
  - scope: project · kind: dir · format: dir
  - 与 `global_commands` 对称，优先级高于全局同名命令
  - 无直接 counterpart

- [ ] **A-1-5** 新增 `project_settings_local` — `.claude/settings.local.json`（本地覆盖层）
  - scope: project · kind: file · format: json
  - 官方支持的本地覆盖，不应提交到 git（.gitignore 排除）
  - 在配置合并优先级中位于 project settings 之上、CLI 参数之下
  - 无 counterpart

- [ ] **A-1-6** 新增 `global_plugins` — `~/.claude/plugins/installed_plugins.json`（插件清单）
  - scope: global · kind: file · format: json · 只读（不提供编辑/删除）
  - 由 Claude Code 自动管理，展示已安装插件列表

### A-2 移除或重构不准确的条目

- [ ] **A-2-1** 移除 `global_stop_hook`（`stop-hook-git-check.sh`）独立条目
  - 原因：Hook 脚本路径是用户自由决定的，硬编码具体路径在概念上是错误的
  - 替代方案：在 `global_settings`（settings.json）的详情页解析并可视化 `hooks` 字段
  - 需同步更新后端 `claude.py` 的 `config_file_specs`

---

## 模块 B：settings.json Hooks 字段可视化

> 依赖 A-2-1 完成后执行

- [ ] **B-1** `FileDetail` 组件新增 Hooks 解析区块
  - 当选中文件为 `settings.json`（global 或 project）时，额外渲染 hooks 展示区
  - 列出所有已注册的 hook 事件及其对应脚本路径
  - 显示脚本文件是否存在（exists 状态）
  - 在 Electron 模式下支持"在 Finder/终端中打开"

- [ ] **B-2** 后端 `/files/meta` 返回 parsed hooks 字段
  - 当 key 为 settings 类条目时，额外解析 JSON 中的 hooks 字段返回结构化数据
  - 前端类型 `ApiFileDetail` 增加可选字段 `parsed_hooks?: ParsedHook[]`

---

## 模块 C：配置关系树更新

> 依赖 A-1 完成后执行

- [ ] **C-1** `ClaudeRelTree` 更新 settings.json 合并优先级图
  - `settings.local.json` 改变的是**层次结构本身**，而非某层内部的合并规则
  - 正确的五层顺序（低 → 高）：
    ```
    内置默认值          ← 最低
    全局用户配置        ← ~/.claude/settings.json
    项目配置            ← .claude/settings.json
    项目本地覆盖        ← .claude/settings.local.json  ← 新增层
    命令行参数          ← 最高（会话级）
    ```
  - 注意：`settings.local.json` 位于"项目配置之上、CLI 参数之下"，是独立的一层，不是项目配置的补充

- [ ] **C-2** `ClaudeRelTree` 更新 CLAUDE.md 加载顺序图
  - 第 1 条改为 `~/.claude/CLAUDE.md`（全局）
  - 第 2 条 `./CLAUDE.md`（项目根）
  - 第 3 条 子目录 CLAUDE.md

- [ ] **C-3** `ClaudeRelTree` 补充 commands/ 与 agents/ 作用域说明
  - 在 Skills & Agents 区块中增加 commands/ 行
  - 区分 global_agents / project_agents / global_commands / project_commands

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

- [ ] **D-1-1** 卡片内部结构改为两段：全局层 + 项目层

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

- [ ] **D-1-2** 去掉纯数字汇总行（"5 个文件已存在 / 3 个未创建"）
  - 替换为：如果有任何关键文件缺失，在卡片底部展示一条橙色警示行，如"⚠ 当前项目 AGENTS.md 未同步"
  - 如果全部关键文件存在，展示绿色"✓ 配置完整"

- [ ] **D-1-3** 关键文件的定义（哪些缺失需要警告）
  - Claude 全局：`~/.claude/CLAUDE.md`、`~/.claude/settings.json`
  - Codex 全局：`~/.codex/AGENTS.md`、`~/.codex/config.toml`
  - 项目层（如果有项目）：`CLAUDE.md` 和 `AGENTS.md` 是配对文件，其中一个存在另一个不存在时，标注"未同步"
  - 非关键文件（技能/Agents/命令）：缺失时展示但不触发警告

### D-2 配置对照表重构（同步对齐视图）

- [ ] **D-2-1** 移除"工作习惯层 / 基础设施层"分组标签
  - 改用用户能理解的分类：**指令 / 技能 / Agent / 设置 / 命令**
  - 每个分类行对应：该功能在 Claude 侧和 Codex 侧各自的文件/目录

- [ ] **D-2-2** 对照表增加"同步状态"列，说明对比的语义
  - 列头：`功能` | `Claude` | `Codex` | `同步状态`
  - 同步状态取值：
    - `✓ 已对齐`：两侧都存在
    - `→ 可迁移`：仅 Claude 侧存在，内容可迁移到 Codex 侧
    - `← 待引入`：仅 Codex 侧存在，未同步到 Claude 侧
    - `✗ 均未配置`：两侧都不存在（不关键则灰色静默，关键则橙色提示）
    - `─ 仅适用于 Claude`：该功能 Codex 无等价机制
  - 这一列让用户理解"对比"的目的是检查 Claude ↔ Codex 配置是否对齐，而非仅展示存不存在

- [ ] **D-2-3** 对照表新增 A-1 / I-2 模块补充的配置项
  - 加入 `global_instructions`（CLAUDE.md ↔ AGENTS.md）
  - 加入 `global_agents`（~/.claude/agents/ ↔ ~/.codex/agents/）
  - 加入 `global_commands`（~/.claude/commands/ — 仅 Claude，标"─"）
  - 去掉`stop_hook` 行（A-2-1 移除后同步删除）

### D-3 合并"当前生效"页面

- [ ] **D-3-1** 将 `active-config`（`/active-config`）页面内容迁移进概览
  - 两个页面当前都展示"哪些文件存在"，信息高度重叠
  - 迁移方式：概览新增一个可折叠的"文件清单"区域（默认折叠），内容等同于当前 active-config 页
  - 迁移完成后，`activeConfigModule` 从导航彻底隐藏（已是 `showInNav: false`，确认无直接入口链接后可保留路由备用）

- [ ] **D-3-2** `pathMappingModule`（`/path-mapping`）同步评估
  - 检查该页面与概览是否也有重叠；若是，一并纳入概览或合并入某个 agent 配置页的"路径说明"区块

### D-4 数据层对接（依赖 J 模块）

- [ ] **D-4-1** 概览使用 `projectPath`（来自 Zustand store，J-2-1 新增）
  - 当 `projectPath` 为 null 时：项目层区域显示"未选择项目"占位提示，对照表只展示全局行
  - 当 `projectPath` 有值时：额外拉取该项目下的文件 meta，填充项目层状态

- [ ] **D-4-2** 数据请求优化
  - 概览所需数据：`GET /files/meta` 批量（或复用 `useAgentFiles` hook）
  - 避免为每个文件单独发请求；如有必要在后端新增 `GET /files/batch-meta?agent=claude&keys=k1,k2,...`（低优先级，可先用并发请求暂代）

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

- [ ] **E-1-1** 页面加载自动触发第一阶段 `POST /sync/scan`（纯只读）
  - scan 无副作用，应主动呈现，不藏在按钮后面
  - 加载中展示骨架屏；后端不可达时展示"后端未运行"提示，不报错
  - scan 完成后展示"扫描结果面板"，出现"查看转换计划 →"按钮

- [ ] **E-1-1b** 用户点击"查看转换计划"触发第二阶段 `POST /sync/plan`（scan + convert，不写）
  - plan 在 scan 结果下方叠加展示转换详情，原 scan 面板保持可见
  - plan 完成后"查看转换计划"按钮变为已完成态，出现"预演（Dry Run）→"按钮

- [ ] **E-1-1c** 用户点击"预演"触发第三阶段 `POST /sync/dry-run`（scan + convert + write dry_run=True）
  - dry-run 在计划结果下方叠加展示每项目标文件的实际冲突检测结果
  - 此时状态标签从"待同步/有冲突"等静态状态变为"将写入/将跳过/将覆盖"等明确预期
  - dry-run 完成后出现"执行同步（N 项）"按钮

- [ ] **E-1-1d** 用户点击"执行同步"触发第四阶段 `POST /sync/execute`（实际写入）
  - 执行结果追加展示，不覆盖前三阶段的面板（保留完整操作历史）

- [ ] **E-1-2** 扫描结果面板逐项展示，每行包含：
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

- [ ] **E-1-3** 每行可展开"转换说明"抽屉
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

- [ ] **E-2-1** 范围选择保留（全部 / 仅全局 / 仅当前项目），与 J 模块 `projectPath` 联动
  - 当 `projectPath` 为 null 时，"仅当前项目"选项置灰并提示"请先选择项目"

- [ ] **E-2-2** 新增"覆盖模式"开关（默认关闭）
  - 关闭时：`有冲突` 状态的文件跳过
  - 开启时：`有冲突` 状态的文件强制覆盖（原文件自动备份为 `.bak.<ts>`）
  - 开启后在扫描面板中将`有冲突`项的标签更新为`将覆盖`（橙色加粗），提升感知

- [ ] **E-2-3** 执行按钮状态
  - 扫描中：禁用，显示"扫描中..."
  - 扫描完成无可同步项：禁用，显示"无需同步"
  - 有待同步或待覆盖项：启用，显示"执行同步（N 项）"

### E-3 执行报告重构

- [ ] **E-3-1** 执行后结果按状态分组展示
  - 分组：`已写入（N）` / `已跳过（N）` / `失败（N）`（失败组折叠默认展开）
  - 移除原有英文状态列，改为中文状态徽章

- [ ] **E-3-2** 每项可展开查看转换前后 diff
  - 对于写入成功的文件，展开后展示"原始内容（来自 Claude 侧）" vs "写入内容（转换后）"的简化 diff
  - diff 格式：红色删除行 / 绿色新增行（仅展示变更行 ±3 行上下文，不展示全文）
  - 覆盖写入的文件额外展示备份路径：`已备份至 ~/.codex/agents/architect.md.bak.20260511T143200`

### E-4 后端：拆分 sync 路由为四个独立接口

> **核心判断**：后端 `scan_global/project()`、`convert_*()`、`write_files(dry_run)` 四类函数已存在且职责分离。
> 问题在于 `_build_plan` 把这四步混在一起，两个路由（`/sync/plan`、`/sync/execute`）把所有阶段耦合了，
> 前端拿到的数据无法区分"扫描到了什么"和"转换后是什么"和"预计写入什么"。
> 改动量小：函数本身不动，只拆路由。

- [ ] **E-4-1** 拆分 `backend/api/routers/sync.py`，将 `_build_plan` 逻辑拆成四个路由

  | 接口 | 调用逻辑 | 返回 |
  |------|----------|------|
  | `POST /sync/scan` | 只调用 `scanner.scan_global()` / `scan_project()` | 每项的类型、名称、源路径、原始内容摘要（不转换） |
  | `POST /sync/plan` | scan + `converter.convert_*()` | scan 结果 + 目标路径 + 转换状态 + `warnings`（删了哪些行） |
  | `POST /sync/dry-run` | scan + convert + `write_files(dry_run=True)` | plan 结果 + 每项目标文件是否已存在、将跳过/写入/覆盖 |
  | `POST /sync/execute` | scan + convert + `write_files(dry_run=False)` | 实际写入报告（写入成功/跳过/失败） |

  - 四个接口共享相同的 request body（scope、project、overwrite）
  - `POST /sync/plan` 和 `POST /sync/dry-run` 保持幂等（无副作用）
  - 现有 `GET /sync/plan` 和 `POST /sync/execute` 路由可先保留做兼容，标记 deprecated

- [ ] **E-4-2** `/sync/plan` 响应透传 `converter.py` 的 `warnings` 字段
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

- [ ] **E-4-3** 新增 `settings.local.json` 排除规则
  - 本地覆盖层含个人敏感配置，不纳入同步范围
  - scan 阶段检测到此类文件时，状态直接设为 `unsupported`，notes 说明"本地覆盖文件不参与同步"

- [ ] **E-4-4** 新增 `global_instructions`、`global_agents`、`global_commands` 同步规则
  - `global_instructions`（CLAUDE.md → AGENTS.md）：加入 scan 范围，走 instruction converter
  - `global_agents`（~/.claude/agents/ → ~/.codex/agents/）：加入 scan 范围，走 agent converter
  - `global_commands`（~/.claude/commands/）：scan 到后状态固定为 `unsupported`，notes 说明"Codex 无等价斜杠命令机制"

---

## 模块 F：后端同步更新

- [ ] **F-1** `backend/core/agents/claude.py` 与前端定义保持一致
  - 新增 A-1 中所有条目的 Python `ConfigFileSpec`
  - 移除 `global_stop_hook` 条目

- [ ] **F-2** `backend/core/scanner.py` 扩展扫描范围
  - 覆盖 `~/.claude/commands/` 和 `.claude/commands/` 目录
  - 覆盖 `~/.claude/agents/`（全局 agent 目录）

- [ ] **F-3** sync 路由拆分（依赖 E-4-1 完成后统一执行）
  - E-4 已描述接口设计；F-3 作为执行入口，标记 E-4-1 ～ E-4-4 为本模块的后端实现任务
  - 涉及文件：`backend/api/routers/sync.py`（路由拆分）、`backend/core/sync/converter.py`（warnings 透传）
  - 执行顺序：F-1（agents 定义）→ F-2（scanner 扩展）→ F-3（路由拆分），三步顺序依赖

---

## 模块 I：Codex Agent 配置定义修正

> 对应文件：`src/agents/codex.ts` + `backend/core/agents/codex.py`

### I-1 错误修正（必须执行）

- [ ] **I-1-1** 修正全局 AGENTS.md 路径
  - 现状：`pathTemplate: '{home}/AGENTS.md'`
  - 应改为：`pathTemplate: '{home}/.codex/AGENTS.md'`
  - 同步更新后端 `codex.py` 对应条目

- [ ] **I-1-2** 修正 agents 目录的格式描述
  - 现状：`details` 中描述格式为 `.md`（从 Claude 照搬）
  - 待改为：Codex agents 文件实际格式（`.toml` 或 `.md`，待验证）
  - **⚠️ 执行前须验证**：检查本机 `~/.codex/agents/` 下实际文件后缀，确认格式后再改
  - 同步更新 `global_agents` 和 `project_agents` 两个条目的 `details` 字段

- [ ] **I-1-3** 重新定位 `~/.agents/skills/` 和 `{project}/.agents/skills/`
  - 现状：作为 Codex 原生 skills 路径收录进 configFiles
  - 实际：这是 cc-steward 设计的迁移中转路径，Codex 本身不原生读取此路径
  - 应改为：从 Codex configFiles 中移除；在同步中心的迁移说明里作为"迁移目标路径"单独标注

### I-2 补充缺失条目（高价值）

- [ ] **I-2-1** 新增 `global_skills` — `~/.codex/skills/`（Codex 原生 skills）
  - scope: global · kind: dir · format: dir
  - Codex 原生 skill 体系的实际存储路径（区别于迁移中转路径 `~/.agents/skills/`）
  - 本机有 doc、pdf、sora、codex-primary-runtime 等实际内容
  - 无直接 counterpart（Claude skills 在 `~/.claude/skills/`，路径和加载机制不同）

- [ ] **I-2-2** 新增 `global_memories` — `~/.codex/memories/`（记忆系统）
  - scope: global · kind: dir · format: dir · 只读展示
  - Codex 独有功能，Claude 无对应机制
  - 需在 `config.toml` 中启用：`[features] memories = true`
  - 目录内包含：`MEMORY.md`、`raw_memories.md`、`memory_summary.md`
  - 展示时注明启用条件；未启用则显示"此功能未开启"

- [ ] **I-2-3** 新增 `global_auth` — `~/.codex/auth.json`（认证文件）
  - scope: global · kind: file · format: json · 只读（不提供编辑/删除）
  - 等价于 Claude 的 `.claude.json`，存储 API key 和 token
  - 详情页标注"由 Codex 自动管理，不建议手动编辑"

### I-3 补充说明（中等价值，在现有条目详情里增加）

- [ ] **I-3-1** `global_config`（config.toml）详情页补充 `[projects]` 字段说明
  - `[projects."/path"]` 段定义每个项目的 `trust_level`，直接影响 Codex 在该项目下的行为权限
  - 在 `details` 字段末尾追加说明，或在 FileDetail 的 settings 解析区块中单独展示

---

## 模块 H：配置生效树 Tab（AgentConfigPage 第三个 Tab）

> 新信息维度：展示各配置维度合并后的实际生效状态，回答"最终哪一层在生效、覆盖关系如何"。  
> 依赖 A-1、F-1、F-2 完成后执行。

### H-1 总览 Tab 减负

- [ ] **H-1-1** 将 `ClaudeRelTree`（静态配置关系知识）从总览 Tab 移除
  - 移入帮助页，新增"配置机制"章节，嵌入完整关系树
  - 总览 Tab 保留：Agent 状态卡片 + 文件状态列表 + 配置对照表，成为纯粹的"状态快照"

- [ ] **H-1-2** 配置生效树 Tab 顶部放静态知识入口
  - 添加"查看配置合并原理 →"链接，跳转到帮助页对应锚点
  - 静态知识与动态状态彻底分离，但保留导航路径

### H-2 后端新增 resolved 接口

- [ ] **H-2-1** 新增 `GET /config/resolved?agent=claude&project=...`
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

- [ ] **H-3-1** `AgentConfigPage` 新增第三个 Tab：`配置生效树`
  - Tab 顺序：总览 / 配置明细 / **配置生效树**

- [ ] **H-3-2** `ResolvedConfigTab` 组件，包含四个子区块：

  **settings.json 合并结果**
  - 每行：字段名 + 当前值（截断显示）+ 来源层徽章（全局 / 项目 / 本地覆盖）+ 是否覆盖上层
  - 第一版只展示顶层 key

  **CLAUDE.md 拼接顺序**
  - 每行：序号 + 文件路径 + exists 状态（✓ / ○）
  - 不展示文件内容，只展示加载结构

  **Skills 覆盖关系**
  - 每行：skill 名称 + 来源（全局 / 项目）+ 是否被项目同名覆盖
  - 被覆盖的全局 skill 用删除线或灰色标注

  **Agents 覆盖关系**
  - 与 Skills 展示形式相同

- [ ] **H-3-3** 加载态与空态处理
  - 加载中：骨架屏占位
  - 后端未运行（mock 模式）：展示提示"需要连接本地后端才能计算合并结果"，不展示假数据

---

## 模块 G：DESIGN.md 文档同步更新

- [ ] **G-1** 更新 Claude 配置关系树章节，补充新增文件
- [ ] **G-2** 更新"后续扩展方向"表格，将已规划项标记为 In-Plan
- [ ] **G-3** 补充 commands/ 与 agents/ 两级作用域的说明

---

## 模块 J：项目路径选择（Project Context Selector）

> 当前所有 API 调用都可以接受 `?project=<path>` 参数，但前端没有提供选择当前工作项目的入口。  
> 本模块为 cc-steward 提供"当前项目上下文"，让配置明细、生效树等视图都基于所选项目展示。

### J-1 后端：项目列表接口

- [ ] **J-1-1** 新增 `GET /projects` 端点（`backend/api/routers/projects.py`）

  **返回结构：**
  ```json
  [
    {
      "path": "/Users/alice/my-project",
      "exists": true,
      "source": "claude",
      "last_used": "2026-05-10T14:32:00"
    },
    {
      "path": "/Users/alice/work/api",
      "exists": true,
      "source": "codex",
      "last_used": null
    }
  ]
  ```
  - `source`: `"claude"` | `"codex"` | `"both"`（同一路径在两侧均出现时合并为 `"both"`）
  - `last_used`: Claude 侧取 `~/.claude/projects/<encoded>/` 目录的 `mtime`；Codex 侧暂设为 `null`
  - 响应按 `last_used` 降序排列（`null` 排末尾）
  - `exists`: 对应真实目录是否仍存在（路径已删除的项目仍展示，前端灰色标注）

  **Claude 侧数据提取（核心算法）：**
  - 扫描 `~/.claude/projects/` 下的所有子目录
  - 目录名是真实路径的编码形式：路径中 `/`、`-`、`_` 均被替换为 `-`，导致解码有歧义
  - 解码算法（回溯法）：将编码名中每个 `-` 视为分隔点，枚举将其还原为 `/`、`-` 或 `_` 的所有组合，对每个候选路径调用 `os.path.exists()` 验证。实测在用户机器上 19/21 成功率，失败的两个案例都是已删除的项目目录
  - 实现位置：`backend/core/agents/claude.py` 中新增 `decode_project_path(encoded: str) -> str | None`；`projects.py` 路由调用此函数
  - 注意：路径解码失败时不丢弃，而是以 `path=None`、`exists=False` 形式返回，前端可展示"路径未知（已删除？）"

  **Codex 侧数据提取：**
  - 解析 `~/.codex/config.toml`（使用标准库 `tomllib` Python 3.11+，低版本用 `tomli` fallback）
  - 读取 `[projects]` 段，其 key 即真实绝对路径（如 `[projects."/home/alice/my-project"]`），无需解码
  - 过滤：只保留 `os.path.isdir(key)` 为真的条目（即当前仍存在的目录）
  - 如果 `~/.codex/config.toml` 不存在，Codex 侧返回空列表，不报错

  **去重合并：**
  - 以规范化绝对路径（`os.path.realpath`）为 key 去重
  - 同一路径同时在 Claude 和 Codex 侧存在时，`source` 设为 `"both"`，`last_used` 取两侧中较大的值

- [ ] **J-1-2** 将 `projects.py` 路由注册到 `backend/api/main.py`
  ```python
  from api.routers import projects
  app.include_router(projects.router)
  ```

### J-2 前端：Zustand Store 扩展

- [ ] **J-2-1** 在 `src/store/index.ts`（或等价 store 文件）中增加 `projectPath` 字段
  ```typescript
  interface AppStore {
    // ...existing fields...
    projectPath: string | null
    setProjectPath: (path: string | null) => void
  }
  ```
  - 初始值 `null`（代表无项目上下文，视图展示全局配置）
  - 持久化：将 `projectPath` 加入 `persist` 的 partialize 列表，下次启动恢复上次选中的项目

- [ ] **J-2-2** 新增 `useProjects` hook（`src/hooks/useProjects.ts`）
  ```typescript
  export function useProjects() {
    // 调用 GET /api/projects，返回 { data, isLoading, error, refetch }
    // 使用 SWR 或 React Query（项目现有依赖决定，查看 package.json 确认）
    // 若后端不可达（mock 模式），返回空数组，不报错
  }
  ```

### J-3 前端：TitleBar 项目选择器

- [ ] **J-3-1** 在 `src/components/layout/TitleBar.tsx`（若不存在则新建）中，在 app title 右侧加入项目选择器

  **UI 结构（示意）：**
  ```
  [cc-steward]  [my-project ▾]                    [─][□][✕]
  ```
  - 选择器文案：`projectPath` 非 null 时显示目录名（`path.basename(projectPath)`），null 时显示 `全局（无项目）`
  - 点击后展开下拉面板（`Popover` 或自定义浮层）

  **下拉面板内容：**
  ```
  ┌──────────────────────────────────────┐
  │  最近使用                             │
  │  ● my-project        [claude+codex]  │
  │  ● api-server        [claude]        │
  │  ○ old-project (已删除)  [claude]    │
  │  ─────────────────────────────────── │
  │  全局（无项目上下文）                  │
  │  ─────────────────────────────────── │
  │  浏览其他目录...                       │
  └──────────────────────────────────────┘
  ```
  - 已删除路径（`exists: false`）灰色 + 删除线，仍可点击选中
  - "全局"选项点击后 `setProjectPath(null)`
  - `source` 徽章：`claude` / `codex` / `both`，用 `ScopeBadge` 组件风格

- [ ] **J-3-2** "浏览其他目录..." 交互
  - **Electron 模式**（`isElectron()` 为 true）：调用 `electronApi.openDirectoryDialog()` 触发系统 `dialog.showOpenDialog({ properties: ['openDirectory'] })`；选择后 `setProjectPath(result.filePaths[0])`
  - **Web 模式**（非 Electron）：将"浏览..."替换为文本输入框，用户手动粘贴路径，回车确认；简单 `os.path.isdir` 校验（调用 `GET /files/meta?...` 等现有接口间接验证，或新增轻量 `GET /projects/validate?path=...`）
  - 选中新路径后调用 `refetch()` 刷新项目列表（将新路径加入最近列表需后端记录，一期可先不实现，刷新后从 Claude/Codex 两侧重新扫描即可）

### J-4 前端：projectPath 透传至所有 API 调用

- [ ] **J-4-1** 审查 `src/core/api.ts` 中所有带 `project` 参数的接口调用处
  - 当前 API 调用是否已经将 `projectPath` 从 store 中透传？确认 `AgentConfigPage` 中的 `useAgentFiles` hook 是否接受并传递 `project` 参数
  - 若未传递：在 hook 层（`useAgentFiles`, `useAgentStatus`）读取 store 中的 `projectPath`，拼入请求 URL

- [ ] **J-4-2** 配置生效树 Tab（H 模块）的 `GET /config/resolved` 接口也需透传 `project`
  - 此项在 H 模块实现时一并处理，此处仅作提醒标注

### J-5 Electron 主进程：目录选择 IPC

- [ ] **J-5-1** 在主进程（`electron/main.ts` 或等价文件）注册 IPC handler
  ```typescript
  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择项目目录',
    })
    return result.canceled ? null : result.filePaths[0]
  })
  ```
  - 先确认现有 `electron-bridge.ts` / `preload.ts` 已有 `openDirectoryDialog` 暴露，若无则一并添加
  - `preload.ts` 中：`openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory')`

---

## 模块 K：Electron 桌面集成深化

> 当前 Electron 集成已有基础（IPC bridge、preload、基本窗口管理），但缺少两个对 macOS 桌面应用体验至关重要的功能：原生菜单和文件变动监听。其余方向（托盘、右键菜单、状态恢复、自动更新）按价值分层，可按需执行。

### K-1 原生应用菜单（高优先级，macOS 基本素养）

- [ ] **K-1-1** 在 `electron/main.ts` 中使用 `Menu.buildFromTemplate` 注册应用菜单

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

- [ ] **K-1-2** renderer 侧注册菜单 IPC 监听
  - 在 `src/lib/electron-bridge.ts`（或 App.tsx 顶层）监听：
    - `app:toggle-theme` → 调用 `useAppStore.getState().setTheme(...)`
    - `app:toggle-sidebar` → 调用 `useAppStore.getState().setSidebarCollapsed(...)`
    - `app:navigate` → 调用 React Router 的 `navigate(path)`
  - 确保监听在组件 unmount 时正确移除（`ipcRenderer.removeListener`）

### K-2 文件变动监听（高优先级，解决数据过期问题）

> 用户在外部编辑配置文件（VS Code / vim）后，cc-steward 无感知，展示的是过期数据。

- [ ] **K-2-1** 在 `electron/main.ts` 中维护 `fs.watch` 监听集合

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

- [ ] **K-2-2** renderer 侧响应 `fs:changed` 事件触发数据刷新
  - 在 `src/lib/electron-bridge.ts` 暴露 `onFsChanged(callback)` 订阅函数
  - 各数据 hook（`useAgentFiles`、`useAgentStatus`、`useProjects`）在 Electron 模式下注册此监听，收到事件后调用 `refetch()`
  - 刷新时不重置页面状态（不清空选中的文件），静默后台刷新
  - 对同一文件的高频变更做 300ms 防抖（由 chokidar `awaitWriteFinish` 处理，renderer 无需额外处理）

- [ ] **K-2-3** 确认 `chokidar` 依赖
  - 检查 `package.json` 中是否已有 `chokidar`（Vite/Electron 工具链常带此依赖）
  - 若无则 `npm install chokidar`，确保其在 `dependencies`（非 devDependencies）中，以便打包进 Electron

### K-3 原生右键菜单（中等优先级）

- [ ] **K-3-1** 文件树节点右键弹出 contextMenu
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

- [ ] **K-4-1** 将 `projectPath`（J-2-1）、`selectedAgentId`、`selectedFileKey` 纳入 Zustand persist
  - 目前只有 `sidebarCollapsed` 和 `theme` 写了 localStorage
  - 使用 Zustand `persist` middleware 的 `partialize` 选项，只持久化需要恢复的字段
  - 重启后 `projectPath` 恢复 → 触发 K-2-1 的 `app:set-project` → 主进程重启文件监听

### K-5 系统托盘（低优先级）

- [ ] **K-5-1** 最小化到托盘，右键菜单提供：切换项目 / 触发同步 / 退出
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

*最后更新：2026-05-11*
