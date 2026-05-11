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

## 模块 D：概览页（Overview）改进

- [ ] **D-1** 对照表补充新增配置项
  - 将 `global_instructions`、`global_agents`、`global_commands`、`project_commands` 加入 COMPARISON_ROWS
  - 更新分组标签：区分"指令层"、"扩展层"、"基础设施层"

- [ ] **D-2** Agent 状态卡片显示插件数量
  - 读取 `installed_plugins.json`，在 Claude 卡片上展示"已安装 N 个插件"

---

## 模块 E：同步中心（Sync）规则更新

- [ ] **E-1** 同步优先级列表新增条目
  - `global_instructions`（CLAUDE.md → AGENTS.md）加入迁移优先级
  - `global_agents`（~/.claude/agents/ → ~/.codex/agents/）加入迁移优先级
  - `global_commands` 标记为"无等价，不迁移"，说明原因

- [ ] **E-2** 同步规划排除 `settings.local.json`
  - 本地覆盖层包含个人敏感配置，明确不纳入同步范围
  - 在同步报告中如有检测到则标注"已跳过（本地覆盖文件）"

---

## 模块 F：后端同步更新

- [ ] **F-1** `backend/core/agents/claude.py` 与前端定义保持一致
  - 新增 A-1 中所有条目的 Python `ConfigFileSpec`
  - 移除 `global_stop_hook` 条目

- [ ] **F-2** `backend/core/scanner.py` 扩展扫描范围
  - 覆盖 `~/.claude/commands/` 和 `.claude/commands/` 目录
  - 覆盖 `~/.claude/agents/`（全局 agent 目录）

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

## 执行顺序建议

```
A-1（补充条目）+ A-2（移除错误条目）
          ↓
    ┌─────┴──────┬──────────────┐
    F（后端同步）  C（关系树更新）  B（hooks 可视化）
    ↓             ↓
    H-2（resolved 接口）
    ↓
    H-1（总览减负）+ H-3（生效树 Tab）
    ↓
    D（概览改进）    E（同步规则）
          ↓
      G（文档更新）
```

---

*最后更新：2026-05-11*
