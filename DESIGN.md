# cc-steward 设计文档

> cc-steward（ClaudeCodex-Together）— Claude Code / Codex CLI 本地配置管理工具

---

## 一、产品定位

cc-steward 是一个**本地桌面配置管理工具**，帮助同时使用 Claude Code 和 Codex CLI 的开发者：

1. **可视化理解**两个工具的所有配置文件：路径、格式、作用、优先级、合并策略
2. **感知当前状态**：哪些文件已存在、哪些尚未创建、各文件当前内容
3. **管理配置文件**：在工具内直接编辑、新建、删除配置文件
4. **工作习惯同步**：将 Claude Code 的使用风格（指令、Skills、Agents）迁移适配到 Codex
5. **配置生效树可视化**：展示各层配置合并结果、指令加载顺序、Skills/Agents 作用域

**核心约束：所有数据来自本地文件系统，不读取或上传任何远程数据。**

---

## 二、核心设计原则

### 2.1 只关注"使用风格层"，不干预"基础设施层"

配置文件分为两类：

| 层次 | 内容 | 同步策略 |
|------|------|----------|
| **工作习惯层** | 指令（CLAUDE.md/AGENTS.md）、Skills、自定义 Agents | 可迁移，是同步重点 |
| **基础设施层** | 模型设置、Hooks、MCP 服务器、认证信息 | 仅展示，不同步 |

工作习惯层的内容高度依赖使用者个人偏好，在 Claude 和 Codex 之间有合理的对应关系。基础设施层配置高度工具专属，强行同步会破坏工具的原生行为。

### 2.2 单向迁移：Claude → Codex

迁移方向固定为 Claude Code → Codex CLI，原因：
- Claude Code 的配置体系更成熟，文件结构更清晰
- Codex 是后引入的工具，用户已有的 Claude 习惯需要"移植"过去
- **绝不修改 Claude 源文件**，Codex 侧是写入目标

### 2.3 查看先于操作（Inspect Before Write）

同步流程强制经过四个阶段：
```
扫描（Scan）→ 规划（Plan）→ 预演（Dry-run）→ 写入（Execute）
```
每一步都向用户展示将要发生的变化，避免意外覆盖。SyncCenter UI 以渐进式展示，各阶段结果持久显示在屏幕上。

### 2.4 保守写入（Conservative Write）

- 目标文件已存在时，**默认跳过**，不覆盖
- 仅在用户明确指定 `--replace` 时才覆盖
- 写入结果三态报告：`Added` / `Check before using` / `Not Added`

---

## 三、技术架构

### 3.1 整体结构

```
┌─────────────────────────────────────────────────────┐
│                  Electron Shell（可选）               │
│   原生菜单 / fs.watch 文件监听 / context-menu IPC     │
├─────────────────────────────────────────────────────┤
│           React 前端  (Vite + TypeScript)            │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ 路由层   │  │  模块注册层   │  │  Agent 注册层  │  │
│  │ React    │  │  ModuleReg   │  │  AgentReg     │  │
│  │ Router   │  │  + Sidebar   │  │  + 配置定义    │  │
│  └──────────┘  └──────────────┘  └───────────────┘  │
│                      Zustand Store                   │
│         （projectPath / recentProjects 持久化）        │
├──────────────────────────────┬──────────────────────┤
│   API Client (src/core/api)  │   Mock Data Fallback  │
│   fetch → /api/*             │   自动降级（无后端时）  │
├──────────────────────────────┴──────────────────────┤
│           FastAPI 后端 (Python 3.11, port 8765)      │
│  /agents  /files  /sync  /config  /health  /meta    │
│  /backup                                             │
├─────────────────────────────────────────────────────┤
│                   本地文件系统                        │
│   ~/.claude/   ~/.codex/   {project}/               │
└─────────────────────────────────────────────────────┘
```

### 3.2 前端技术选型

| 技术 | 用途 |
|------|------|
| React 18 + TypeScript | UI 框架 |
| Vite | 构建工具，开发代理 `/api` → `127.0.0.1:8765` |
| Tailwind CSS | 样式，自定义设计 Token（`surface`、`text`、`accent`、`status`） |
| Zustand | 全局状态（projectPath、recentProjects、sidebarCollapsed、theme） |
| React Router v6 | 客户端路由，模块动态注册路由 |
| Lucide React | 图标库 |

### 3.3 后端技术选型

| 技术 | 用途 |
|------|------|
| FastAPI (Python) | REST API 服务，本地 127.0.0.1:8765 |
| Pydantic | 请求/响应类型校验 |
| pathlib | 跨平台文件路径操作 |

### 3.4 Mock 降级机制

前端 API 客户端内置自动降级逻辑：
1. 首次请求时 probe `/api/health`（800ms 超时）
2. 后端不可达 → `useMock = true`，后续请求全部返回预置 mock 数据
3. UI 顶部显示"演示模式"横幅
4. 开发/预览阶段可 `VITE_USE_MOCK=true` 强制 mock 模式

这使得前端可以**完全独立于后端**进行开发和演示。

---

## 四、扩展性设计

### 4.1 Agent 注册机制

新增支持的 Agent（如 Cursor、Windsurf）只需：

1. 在 `src/agents/` 创建 `xxx.ts`，实现 `AgentDefinition` 接口
2. 在 `src/agents/index.ts` 注册：`agentRegistry.register(xxxAgent)`
3. 在 `backend/core/agents/` 创建对应 Python 类，注册到 `registry`

无需修改任何核心代码。

```typescript
// AgentDefinition 接口
interface AgentDefinition {
  id: string
  name: string
  shortName: string
  color: string
  Icon: LucideIcon
  globalDir: string
  hookEvents: string[]
  configFiles: ConfigFileSpec[]
}
```

每个 `ConfigFileSpec` 描述一个配置文件：路径模板、格式、作用说明、生效原理、对应的 counterpart（用于同步关系展示）。

#### Claude Code 配置文件规格（13 个）

| key | 路径 | 说明 |
|-----|------|------|
| `global_settings` | `~/.claude/settings.json` | 全局用户设置 |
| `global_instructions` | `~/.claude/CLAUDE.md` | 全局指令文件 |
| `global_agents` | `~/.claude/agents/` | 全局自定义 Agents 目录 |
| `global_commands` | `~/.claude/commands/` | 全局自定义斜杠命令目录 |
| `global_plugins` | `~/.claude/plugins/installed_plugins.json` | 已安装插件列表 |
| `global_auth` | `~/.claude.json` | 全局认证信息 |
| `global_mcp` | `~/.claude/mcp.json` | 全局 MCP 服务器配置 |
| `project_settings` | `.claude/settings.json` | 项目级设置 |
| `project_settings_local` | `.claude/settings.local.json` | 项目本地设置（不加入 VCS） |
| `project_instructions` | `CLAUDE.md` | 项目指令文件 |
| `project_agents` | `.claude/agents/` | 项目级自定义 Agents 目录 |
| `project_commands` | `.claude/commands/` | 项目级自定义斜杠命令目录 |
| `project_mcp` | `.claude/mcp.json` | 项目级 MCP 服务器配置 |

#### Codex CLI 配置文件规格（11 个）

| key | 路径 | 说明 |
|-----|------|------|
| `global_config` | `~/.codex/config.yaml` | 全局配置（模型、行为） |
| `global_instructions` | `~/.codex/AGENTS.md` | 全局指令文件 |
| `global_skills` | `~/.codex/skills/` | 全局 Skills 目录（原生路径） |
| `global_memories` | `~/.codex/memories/` | 全局持久记忆目录 |
| `global_auth` | `~/.codex/auth.json` | 全局认证信息 |
| `global_agents` | `~/.codex/agents/` | 全局自定义 Agents 目录 |
| `project_config` | `.codex/config.yaml` | 项目级配置 |
| `project_instructions` | `AGENTS.md` | 项目指令文件 |
| `project_agents` | `.codex/agents/` | 项目级自定义 Agents 目录 |
| `project_memories` | `.codex/memories/` | 项目级记忆目录 |
| `project_skills` | `.codex/skills/` | 项目级 Skills 目录 |

### 4.2 模块注册机制

新增功能模块只需：

1. 在 `src/modules/` 创建目录，实现 `ModuleDefinition`
2. 在 `src/modules/index.ts` 注册

模块支持分组（`group` 字段），注册顺序控制侧边栏位置。

```typescript
interface ModuleDefinition {
  id: string
  label: string
  path: string
  Icon: LucideIcon
  group?: string          // 侧边栏分组标题
  showInNav?: boolean     // 是否出现在侧边栏
  Component: React.ComponentType
}
```

---

## 五、界面层次结构

```
TitleBar
├── 项目路径下拉选择器（ProjectSelector）
│   ├── 当前项目文件夹名称
│   ├── 最近项目列表（localStorage 持久化，最多 10 条）
│   ├── Electron 原生文件夹选择器（或文本输入降级）
│   └── 切换项目触发全局数据刷新

侧边栏（一级）
├── 概览                    /overview
├── 配置管理（分组标题）
│   ├── Claude             /config/claude
│   └── Codex              /config/codex
├── 同步中心               /sync
└── 说明                   /help

每个 Agent 页（二级）—— 3 个 Tab
├── Tab: 总览
│   ├── 统计卡片（已存在/未创建/全局/项目）
│   ├── 文件状态列表
│   └── 配置关系树（Claude 专属）
├── Tab: 配置明细
│   ├── 左侧文件树（按全局/项目分组）
│   └── 右侧文件详情（三级）
│       ├── 路径 + 格式 + 作用域
│       ├── 作用说明
│       ├── 生效原理
│       ├── 当前内容查看
│       ├── 编辑 / 新建 / 删除操作
│       └── 同步关系（counterpart）
└── Tab: 配置生效树（新）
    ├── Settings 合并结果表
    │   └── 键名 / 生效值 / 来源层（含覆盖链）
    ├── 指令加载顺序列表
    ├── Skills 作用域（含同名覆盖检测）
    └── Agents 作用域（含同名覆盖检测）
```

---

## 六、Claude 配置关系树

Claude Code 的配置采用多层合并模型，cc-steward 将其可视化展示。

### settings.json 合并优先级（低 → 高）

```
① 内置默认值         （Claude Code 二进制内部）
    ↓
② 全局用户配置       ~/.claude/settings.json
    ↓
③ 项目配置           .claude/settings.json
    ↓
④ 项目本地配置       .claude/settings.local.json（不加入 VCS）
    ↓
⑤ 命令行参数         --config / --model（会话级，最高优先）
```

合并策略：同字段高优先级覆盖低优先级；`hooks`、`permissions` 数组按层合并追加。`settings.local.json` 作为独立层位于项目配置与 CLI 参数之间，用于存放本机专属覆盖（不提交到版本控制）。

### CLAUDE.md 加载顺序（全部加载，拼接注入）

```
① ~/.claude/CLAUDE.md     全局指令
② ./CLAUDE.md             项目根目录
③ ./<subdir>/CLAUDE.md    子目录（进入对应目录时自动加载）
```

### Skills / Agents 作用域

| 层级 | 路径 | 说明 |
|------|------|------|
| 全局 Agents | `~/.claude/agents/` | 所有项目可用 |
| 项目 Agents | `.claude/agents/` | 项目专属，同名覆盖全局 |
| 全局 Commands | `~/.claude/commands/` | 所有项目可用的斜杠命令 |
| 项目 Commands | `.claude/commands/` | 项目专属斜杠命令，同名覆盖全局 |

---

## 七、后端 API

### 7.1 端点总览

后端路由在 `backend/main.py` 中注册，端口 `127.0.0.1:8765`：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/meta` | GET | 工具版本、环境信息 |
| `/agents` | GET | 已注册 Agent 列表及配置文件规格 |
| `/files/meta` | GET | 单个配置文件元数据及内容 |
| `/files/write` | POST | 写入配置文件 |
| `/files/delete` | DELETE | 删除配置文件 |
| `/sync/scan` | POST | 阶段 1：原始扫描（不转换） |
| `/sync/plan` | POST | 阶段 2：扫描 + 转换，返回 warnings |
| `/sync/dry-run` | POST | 阶段 3：扫描 + 转换 + 写入（dry_run=True） |
| `/sync/execute` | POST | 阶段 4：实际写入 |
| `/config/resolved` | GET | 合并后配置树（见 7.2） |
| `/backup` | POST/GET | 配置备份与恢复 |

### 7.2 /config/resolved 端点

```
GET /config/resolved?agent=claude&project=/path/to/project
```

返回内容：
- `settings_merge`：各层 settings.json 合并结果，每个键附带来源层及覆盖链
- `instruction_load_order`：CLAUDE.md / AGENTS.md 加载顺序列表
- `skills_scope`：Skills 作用域及同名覆盖检测结果
- `agents_scope`：Agents 作用域及同名覆盖检测结果

前端 `ResolvedConfigTab` 组件消费此端点，在"配置生效树"Tab 中展示。

---

## 八、同步策略

### 8.1 四阶段同步流程

```
POST /sync/scan     → 阶段 1：原始扫描（不做转换）
POST /sync/plan     → 阶段 2：扫描 + 转换，返回 warnings
POST /sync/dry-run  → 阶段 3：扫描 + 转换 + 写入（dry_run=True，预览变化）
POST /sync/execute  → 阶段 4：实际写入目标文件
```

SyncCenter UI 以渐进式 4 阶段流程展示，每个阶段完成后结果持久显示在屏幕上，用户可逐阶段确认再继续。

### 8.2 可同步项（工作习惯层）

| Claude 源 | Codex 目标 | 转换规则 |
|-----------|-----------|---------|
| `CLAUDE.md` | `AGENTS.md` | 内容复制，清洗 Claude 专属语法（斜杠命令引用等） |
| `~/.claude/CLAUDE.md` | `~/.codex/AGENTS.md` | 同上，全局层 |
| `~/.claude/skills/<name>/` | `~/.codex/skills/<name>/` | frontmatter 适配，写入 Codex 原生 skills 路径 |
| `.claude/agents/<name>.md` | `.codex/agents/<name>.md` | frontmatter 适配，tools 列表转换 |

### 8.3 不同步项（基础设施层 / 不支持项）

| 条目 | 状态 | 原因 |
|------|------|------|
| Hooks（SessionStart、Stop 等） | `unsupported` | Codex 无对应机制 |
| MCP 服务器配置 | 不同步 | 工具专属 |
| 模型设置 | 不同步 | 工具专属 |
| 认证信息（`.claude.json`） | 不同步 | 安全约束 |
| Commands（全局/项目） | `unsupported` | Codex 无等价斜杠命令机制 |
| `settings.local.json` | 排除 | 本机专属，不纳入同步 |

---

## 九、文件 CRUD 操作

| 操作 | 前端行为 | 后端接口 |
|------|----------|---------|
| **查看** | 文件详情面板展示内容 | `GET /files/meta` |
| **编辑/新建** | 内联 textarea，点击保存 | `POST /files/write` |
| **删除** | 二次确认弹层，确认后删除 | `DELETE /files/delete` |

安全约束：
- 仅允许操作已知配置文件路径（由 AgentDefinition 定义）
- 目录类型文件不可删除
- 写入时自动创建父目录

---

## 十、Electron 原生功能

cc-steward 支持以 Electron 桌面应用模式运行，提供以下原生能力：

### 10.1 原生应用菜单

通过 `Menu.buildFromTemplate` 构建完整原生菜单：

| 菜单 | 内容 |
|------|------|
| 文件 | 打开项目、切换项目、退出 |
| 编辑 | 撤销/重做/复制/粘贴等标准编辑操作 |
| 视图 | 重载、开发工具、缩放控制 |
| 窗口 | 最小化、最大化、全屏切换 |
| 帮助 | 关于、文档链接 |

### 10.2 文件系统监听

`electron/main.ts` 使用 Node.js `fs.watch` 监听当前 `projectPath`：
- 检测到配置文件变动时，通过 IPC 通知渲染进程
- 渲染进程自动触发数据刷新，保持界面与磁盘状态同步
- 切换项目时旧监听器销毁，新监听器建立

### 10.3 IPC Bridge

`electron/preload.ts` 提供完整 IPC Bridge，暴露给渲染进程的接口包括：

| IPC 事件 | 方向 | 说明 |
|----------|------|------|
| `cct:show-context-menu` | 渲染 → 主 | 触发原生右键菜单 |
| `cct:watch-path` | 渲染 → 主 | 注册文件系统监听路径 |
| `cct:fs-changed` | 主 → 渲染 | 文件变动通知 |
| `cct:open-folder-dialog` | 渲染 → 主 | 打开原生文件夹选择对话框 |

### 10.4 状态持久化

以下状态持久化到 `localStorage`：

| 键 | 类型 | 说明 |
|----|------|------|
| `projectPath` | `string` | 当前项目路径 |
| `recentProjects` | `string[]` | 最近项目列表（最多 10 条） |
| `sidebarCollapsed` | `boolean` | 侧边栏折叠状态 |
| `theme` | `string` | 界面主题 |

---

## 十一、项目结构

```
ClaudeCodex-Together/
├── src/
│   ├── agents/              Agent 定义层
│   │   ├── claude.ts        Claude Code 13 个配置文件规格
│   │   ├── codex.ts         Codex CLI 11 个配置文件规格
│   │   └── index.ts
│   ├── core/
│   │   ├── agent-registry.ts
│   │   ├── module-registry.ts
│   │   ├── api.ts            API 客户端（含 ApiResolvedConfig 等新类型）
│   │   └── mock-data.ts
│   ├── modules/
│   │   ├── overview/         全局概览（双 Agent 卡片 + 对比表 + 同步状态）
│   │   ├── agent-config/     per-agent 配置页（总览/配置明细/配置生效树 3 tabs）
│   │   ├── sync/             同步中心（4 阶段渐进式 UI）
│   │   └── help/
│   ├── components/
│   │   ├── layout/           AppShell / Sidebar / TitleBar（含 ProjectSelector）
│   │   └── ui/               ProjectSelector, Badges, Skeleton 等
│   └── store/                Zustand（projectPath/recentProjects 持久化）
├── backend/
│   ├── main.py               FastAPI 入口
│   ├── core/
│   │   ├── agents/           claude.py / codex.py（与前端定义镜像）
│   │   ├── scanner.py        扫描（含 commands 目录）
│   │   ├── converter.py      配置转换（附 warnings）
│   │   └── writer.py         安全写入
│   └── api/routers/          agents / files / sync（4路由）/ config / backup
├── electron/
│   ├── main.ts               原生菜单 / fs.watch / context-menu IPC
│   └── preload.ts            完整 IPC bridge（含 showContextMenu/watchPath/onFsChanged）
└── docs/
    ├── ROADMAP.md
    └── IMPLEMENTATION.md
```

---

## 十二、后续扩展方向

| 方向 | 状态 | 说明 |
|------|------|------|
| 多项目切换 | ✅ 已实现 | TitleBar ProjectSelector，最近项目持久化 |
| 自动同步触发 | ✅ 已实现 | Electron fs.watch 监听文件变动 → 自动刷新 |
| 更多 Agent 支持 | 规划中 | Cursor、Windsurf、Gemini CLI — 实现 AgentDefinition 即可接入 |
| 双向 diff 视图 | 规划中 | 对比 Claude 和 Codex 同类文件的内容差异 |
| 会话管理 | 规划中 | 查看历史会话记录、成本统计 |
| 配置模板库 | 规划中 | 社区共享的 CLAUDE.md / AGENTS.md 模板 |

---

> 最后更新：2026-05-11
