# CCT 设计文档

> ClaudeCodex-Together — Claude Code / Codex CLI 本地配置管理工具

---

## 一、产品定位

CCT 是一个**本地桌面配置管理工具**，帮助同时使用 Claude Code 和 Codex CLI 的开发者：

1. **可视化理解**两个工具的所有配置文件：路径、格式、作用、优先级、合并策略
2. **感知当前状态**：哪些文件已存在、哪些尚未创建、各文件当前内容
3. **管理配置文件**：在工具内直接编辑、新建、删除配置文件
4. **工作习惯同步**：将 Claude Code 的使用风格（指令、Skills、Agents）迁移适配到 Codex

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

同步流程强制经过三个阶段：
```
扫描（Scan）→ 规划（Plan）→ 预演（Dry-run）→ 写入（Write）
```
每一步都向用户展示将要发生的变化，避免意外覆盖。

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
├─────────────────────────────────────────────────────┤
│           React 前端  (Vite + TypeScript)            │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ 路由层   │  │  模块注册层   │  │  Agent 注册层  │  │
│  │ React    │  │  ModuleReg   │  │  AgentReg     │  │
│  │ Router   │  │  + Sidebar   │  │  + 配置定义    │  │
│  └──────────┘  └──────────────┘  └───────────────┘  │
│                      Zustand Store                   │
├──────────────────────────────┬──────────────────────┤
│   API Client (src/core/api)  │   Mock Data Fallback  │
│   fetch → /api/*             │   自动降级（无后端时）  │
├──────────────────────────────┴──────────────────────┤
│           FastAPI 后端 (Python 3.11, port 8765)      │
│  /agents  /files  /sync  /health  /meta             │
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
| Zustand | 全局状态（projectPath、agentFiles、selectedFile） |
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
侧边栏（一级）
├── 概览                    /overview
├── 配置管理（分组标题）
│   ├── Claude             /config/claude
│   └── Codex              /config/codex
├── 同步中心               /sync
└── 说明                   /help

每个 Agent 页（二级）
├── Tab: 总览
│   ├── 统计卡片（已存在/未创建/全局/项目）
│   ├── 文件状态列表
│   └── 配置关系树（Claude 专属）
└── Tab: 配置明细
    ├── 左侧文件树（按全局/项目分组）
    └── 右侧文件详情（三级）
        ├── 路径 + 格式 + 作用域
        ├── 作用说明
        ├── 生效原理
        ├── 当前内容查看
        ├── 编辑 / 新建 / 删除操作
        └── 同步关系（counterpart）
```

---

## 六、Claude 配置关系树

Claude Code 的配置采用多层合并模型，CCT 将其可视化展示：

### settings.json 合并优先级（低 → 高）

```
① 内置默认值      （Claude Code 二进制内部）
    ↓
② 全局用户配置    ~/.claude/settings.json
    ↓
③ 项目配置        .claude/settings.json
    ↓
④ 命令行参数      --config / --model（会话级，最高优先）
```

合并策略：同字段高优先级覆盖低优先级；`hooks`、`permissions` 数组按层合并追加。

### CLAUDE.md 加载顺序（全部加载，拼接注入）

```
① ~/.claude/CLAUDE.md     全局指令
② ./CLAUDE.md             项目根目录
③ ./<subdir>/CLAUDE.md    子目录（进入对应目录时自动加载）
```

### Skills / Agents 作用域

| 层级 | 路径 | 说明 |
|------|------|------|
| 全局 Skills | `~/.claude/skills/` | 所有项目可用 |
| 项目 Agents | `.claude/agents/` | 项目专属，同名覆盖全局 |

---

## 七、同步策略

### 可同步项（工作习惯层）

| Claude 源 | Codex 目标 | 转换规则 |
|-----------|-----------|---------|
| `CLAUDE.md` | `AGENTS.md` | 内容复制，清洗 Claude 专属语法（斜杠命令引用等） |
| `~/.claude/skills/<name>/SKILL.md` | `~/.agents/skills/<name>.md` | frontmatter 适配 |
| `.claude/agents/<name>.md` | `.codex/agents/<name>.md` | frontmatter 适配，tools 列表转换 |

### 不同步项（基础设施层）

- Hooks（`SessionStart`、`Stop` 等 Codex 不支持）
- MCP 服务器配置
- 模型设置
- 认证信息（`.claude.json`）

---

## 八、文件 CRUD 操作

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

## 九、项目结构

```
ClaudeCodex-Together/
├── src/
│   ├── agents/              Agent 定义层
│   │   ├── claude.ts        Claude Code 8 个配置文件规格
│   │   ├── codex.ts         Codex CLI 10 个配置文件规格
│   │   └── index.ts         注册入口
│   ├── core/
│   │   ├── agent-registry.ts
│   │   ├── module-registry.ts
│   │   ├── api.ts            API 客户端 + mock 降级
│   │   └── mock-data.ts      完整演示数据
│   ├── modules/              功能模块
│   │   ├── overview/         全局概览
│   │   ├── agent-config/     per-agent 配置页 + 关系树
│   │   ├── sync/             同步中心
│   │   └── help/             说明文档
│   ├── components/layout/    AppShell / Sidebar / TitleBar
│   └── store/                Zustand 全局状态
├── backend/
│   ├── main.py               FastAPI 入口，CORS，路由挂载
│   ├── core/
│   │   ├── agents/           Python Agent 实现（与前端镜像）
│   │   ├── scanner.py        本地文件扫描
│   │   ├── converter.py      配置格式转换
│   │   └── writer.py         安全写入
│   └── api/routers/          agents / files / sync
├── scripts/
│   └── screenshot*.mjs       Playwright 截图脚本
└── electron/                 桌面壳（可选）
```

---

## 十、后续扩展方向

| 方向 | 说明 |
|------|------|
| 更多 Agent 支持 | Cursor、Windsurf、Gemini CLI — 实现 AgentDefinition 即可接入 |
| 双向 diff 视图 | 对比 Claude 和 Codex 同类文件的内容差异 |
| 会话管理 | 查看历史会话记录、成本统计 |
| 配置模板库 | 社区共享的 CLAUDE.md / AGENTS.md 模板 |
| 自动同步触发 | 监听文件变动，自动提示同步 |
| 多项目切换 | 快速切换当前管理的项目目录 |
