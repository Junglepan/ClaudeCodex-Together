# 实现方案 / Implementation

> 每次功能迭代或方案更新后刷新本文档，保持其反映**当前**实现而非历史。  
> 历史记录见 [CHANGELOG.md](../CHANGELOG.md)。

最近更新：2026-05-09 (二)

---

## 1. 总体架构

```
┌─────────────────────────────┐    HTTP /api/*    ┌─────────────────────────────┐
│  Electron 主进程             │  ───────────────▶ │  FastAPI backend (8765)     │
│  - spawn 后端 + 创建窗口     │                   │  - 扫描 ~/.claude / ~/.codex│
│  - 加载 vite (dev) / dist    │                   │  - 文件 CRUD                │
│    (prod) 中的前端           │                   │  - 同步 plan / execute      │
└─────────────┬───────────────┘                   └─────────────────────────────┘
              │ loadURL                                       ▲
              ▼                                               │
┌─────────────────────────────┐  vite proxy /api → 8765       │
│  前端 React (5174)           │  ─────────────────────────────┘
│  - Zustand store             │
│  - hooks 层 (useAgents…)    │
│  - 模块注册表 (动态扩展)    │
└─────────────────────────────┘
```

进程拓扑：
- **dev**：`npm run dev:frontend` 启动 vite (5174)；后端可由 `npm run dev:backend` 单独启，也可由 Electron `main.ts` spawn
- **prod**：Electron 启动时 spawn `python3 -m uvicorn main:app`，再加载打包后的前端 HTML

---

## 2. 后端

### 2.1 目录

```
backend/
├── main.py                   FastAPI 入口（CORS + router 挂载）
├── api/routers/
│   ├── agents.py            /agents, /agents/:id/files
│   ├── files.py             /files/{meta,read,write,delete}
│   └── sync.py              /sync/plan, /sync/execute
└── core/
    ├── agents/              agent 抽象 + claude / codex 实现 + registry
    ├── scanner.py           扫描 ~/.claude 中的 instructions/skills/agents
    ├── converter.py         frontmatter / 工具引用清洗
    └── writer.py            写文件，支持 dry-run / replace
```

### 2.2 核心抽象

- `AgentBase` 定义每个 agent 的 `global_dir_template` 与 `config_file_specs`，统一通过 `resolve_path({home}, {project})` 渲染
- `ConfigFileSpec` 描述一个配置文件（路径模板、scope、kind、format、purpose、对应 agent 等）
- `AgentRegistry` 注册全部 agent 实例（claude + codex）

### 2.3 关键端点

| 路径 | 方法 | 用途 |
|---|---|---|
| `/health` | GET | 心跳 |
| `/meta` | GET | 项目路径、HOME、平台、hostname、python 版本 |
| `/agents` | GET | agent 摘要：状态 + 已存在文件数 |
| `/agents/:id/files` | GET | 该 agent 全部 spec + 实际存在/大小/mtime |
| `/files/meta` | GET | 单文件元信息 + 内容（≤ 文件型）+ 对照 agent 路径 |
| `/files/{read,write,delete}` | GET/POST/DELETE | 任意路径的文件 IO（仅 path 校验，无沙箱） |
| `/sync/plan`, `/sync/execute` | POST | 计算同步项并可选写入 |

---

## 3. 前端

### 3.1 目录

```
src/
├── App.tsx                       路由 + 全局 shortcuts + meta 重试
├── main.tsx                      ReactDOM root
├── store/index.ts                Zustand store（含持久化）
├── core/
│   ├── api.ts                    fetch 封装（无 mock）
│   ├── agent-registry.ts         前端 agent 元数据注册表
│   └── module-registry.ts        模块（页面）注册表
├── hooks/
│   ├── useAgents.ts              拉取 summaries + filesByAgent，refresh()
│   └── useShortcuts.ts           键盘绑定
├── lib/
│   └── shortcut-catalog.ts       快捷键展示元数据（Settings + Help 共用）
├── components/
│   ├── layout/                   AppShell / Sidebar / TitleBar
│   └── ui/                       Badges / Skeleton / Toast
├── agents/                       claude.ts / codex.ts 元数据 + Icon/color
└── modules/                      每个页面一个目录，自注册到 moduleRegistry
    ├── overview/
    ├── active-config/
    ├── agent-config/
    ├── config-files/
    ├── sync/
    ├── settings/                 偏好（外观/快捷键/环境/关于）
    └── help/                     说明（含锚点 TOC）
```

### 3.2 状态管理（Zustand）

| key | 用途 |
|---|---|
| `projectPath`, `platform` | 来自 `/meta` |
| `agentSummaries`, `agentFiles` | 真实数据缓存 |
| `selectedFile` | 文件树选中项 |
| `loading`, `refreshing`, `error` | 全局 IO 状态 |
| `toasts`, `pushToast`, `dismissToast` | 通知 |
| `sidebarCollapsed`（持久化） | 侧栏折叠状态 |

持久化只覆盖 `sidebarCollapsed`，写入 `localStorage['cct.state']`。

### 3.3 数据流

```
useAgents() ─▶ Promise.all([api.agents.list, api.agents.files * N])
            └─▶ store.setAgentSummaries / setAgentFiles
            └─▶ 失败 → pushToast(error)
```

刷新可由：
- TitleBar 刷新按钮
- 全局 ⌘R 快捷键
- 各页面内部的小刷新按钮（FilesTab / ConfigFiles / AgentConfigPage）

均走同一份逻辑，统一 toast 反馈与 spin 状态。

### 3.4 模块注册

`moduleRegistry.register({ id, label, path, Icon, group?, Component })` 注册一个页面：
- `group`：在 sidebar 中归到可折叠分组
- 路由由 `App.tsx` 从 registry 动态构建

### 3.5 快捷键映射

| 快捷键 | 行为 |
|---|---|
| ⌘R | 刷新 agents + files |
| ⌘B | 折叠/展开侧栏 |
| ⌘1 / ⌘2 / ⌘3 | overview / files / sync |
| `/` | 聚焦当前页搜索框 |
| ⌘S | 编辑器内保存 |
| Esc | 编辑器内取消、关闭对话 |

---

## 4. Electron

`electron/main.ts`：
- `BACKEND_PORT=8765`, `FRONTEND_PORT=5174`
- 启动顺序：`whenReady → startBackend (spawn uvicorn) → createWindow`
- dev：加载 `http://localhost:5174`；prod：加载 `dist/index.html`
- DevTools 默认关闭，`CCT_DEVTOOLS=1` 显式开启（detach 模式独立窗口）

`electron/preload.ts`：当前为空骨架，预留给未来 IPC（文件选择、原生菜单等）。

---

## 5. 端口与路径约定

| 端口 / 路径 | 说明 |
|---|---|
| 5174 | Vite dev server（本机 5173 已被其他项目占用） |
| 8765 | FastAPI 后端 |
| `~/.claude/` | Claude Code 配置根 |
| `~/.codex/` | Codex CLI 配置根 |
| `~/.agents/skills/` | 共享 skills（迁移目标） |

---

## 6. 后续路线

1. 打包验证：`npm run build` + `electron-builder` 全流程，产物启动测试
2. FileDetail "前往同步中心" 跳转 + 携带预选项
3. Settings：项目路径切换（IPC + native dialog）、深色模式
4. Help 模块：文件结构图（已加目录、快捷键、Agent 卡片）
5. 同步前的差异预览（diff）
6. backend 路径白名单校验（避免越权写）
