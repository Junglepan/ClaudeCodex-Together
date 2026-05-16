<!-- LOGO -->
<h1>
<p align="center">
  <img src="assets/icon.png" alt="cc-steward" width="128">
  <br>cc-steward
</h1>
  <p align="center">
    Claude Code / Codex CLI 本地配置、会话管家<br/>
    可视化管理、对照、同步两套 AI 编程工具的全部配置。
    <br />
    <br />
    <a href="#下载安装">下载安装</a>
    ·
    <a href="#功能介绍">功能介绍</a>
    ·
    <a href="#本地构建">本地构建</a>
    ·
    <a href="#作者">作者</a>
  </p>
</p>

<p align="center">
  <a href="https://github.com/Junglepan/ClaudeCodex-Together/releases">
    <img src="https://img.shields.io/github/v/release/Junglepan/ClaudeCodex-Together?include_prereleases" alt="Release">
  </a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" alt="Platform">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

---

## 为什么需要 cc-steward

Claude Code 和 Codex CLI 是当前最主流的两款 AI 终端编程工具。它们各自拥有一套独立的配置体系：

| | Claude Code | Codex CLI |
|---|---|---|
| 全局指令 | `~/.claude/CLAUDE.md` | `~/.codex/AGENTS.md` |
| 全局设置 | `~/.claude/settings.json` | `~/.codex/config.toml` |
| 技能 / Agents | `~/.claude/commands/` `agents/` | `~/.codex/skills/` `agents/` |
| 项目指令 | `项目/CLAUDE.md` | `项目/AGENTS.md` |
| 项目设置 | `项目/.claude/settings.json` | `项目/.codex/config.toml` |

当你同时使用两者时，会面临：

- **配置分散**：十几个配置文件散落在不同路径，格式各异（Markdown / JSON / TOML）
- **状态不透明**：哪些文件已创建？哪些还缺？当前生效的是全局还是项目级？
- **同步困难**：在 Claude 侧写好的指令和工作流，想在 Codex 侧也用上，需要手动转换格式
- **覆盖规则复杂**：全局 → 项目 → 本地覆写，多层合并后到底生效了什么？

cc-steward 解决这些问题 — 一个界面看清全部配置、一键同步两侧差异。

## 预览

<!-- TODO: 添加更多截图 -->
<!-- ![概览页](docs/screenshots/overview.png) -->
![img.png](img.png)
<!-- ![同步中心](docs/screenshots/sync.png) -->
![img_1.png](img_1.png)

## 下载安装

前往 [Releases](https://github.com/Junglepan/ClaudeCodex-Together/releases) 下载最新版本：

| 平台 | 文件 |
|------|------|
| macOS (Apple Silicon) | `cc-steward-x.x.x-arm64.dmg` |
| Windows x64 | `cc-steward.Setup.x.x.x.exe` |
| Linux x64 | `cc-steward-x.x.x.AppImage` |

> **macOS 首次打开提示"已损坏"或"无法验证开发者"：**
>
> ```bash
> xattr -cr /Applications/cc-steward.app
> ```
>
> 执行后直接双击打开即可。

## 功能介绍

### 配置总览

概览页以双卡片布局并排展示 Claude Code 和 Codex CLI 的配置状态：

- **全局层**：全局指令、技能、Agents、命令、全局设置 — 每项标注文件名与配置状态（已配置 / 未配置）
- **项目层**：当前项目目录下的指令文件、agents 目录、项目设置 — 自动检测文件是否存在
- **健康状态**：底部一行总结「配置完整」或「关键配置文件未找到」，快速判断是否需要初始化

### 配置对照表

概览页下半部分以表格形式对照两套工具的同类配置：

| 配置功能 | Claude | Codex | 同步状态 |
|---------|--------|-------|---------|
| 全局指令 | `CLAUDE.md` | `AGENTS.md` | ✅ 已对齐 |
| 全局技能 | `skills/` | `.codex/skills/` | ✅ 已对齐 |
| 全局 Agent | `agents/` | `.codex/agents/` | ✅ 已对齐 |
| 全局设置 | `settings.json` | `config.toml` | ✅ 已对齐 |
| 斜杠命令 | `commands/` | — | — 仅适用于 Claude |

一眼看出哪些配置两侧已对齐、哪些「可迁移」（一侧有内容但另一侧缺失）、哪些仅适用于单侧。

### 配置文件管理

在侧栏「配置管理 → Claude / Codex」中深入每个 Agent 的配置文件树：

- **文件浏览**：按全局 / 项目分组展示所有配置文件，标注存在状态、文件大小、最后修改时间
- **在线编辑**：直接在工具内查看和编辑配置文件内容，支持 `⌘S` 保存 / `Esc` 取消
- **新建与删除**：对尚未创建的配置文件可一键新建模板；删除前自动备份
- **系统集成**（Electron）：右键可在 Finder 中显示、在终端打开所在目录

### 配置生效树

每个 Agent 的「已解析配置」标签页展示多层合并后的最终生效值：

- **设置项**：逐条列出 key / value / 来源层（global / project / local_override / merged），清楚展示覆盖关系
- **指令链**：按加载顺序列出所有指令文件（全部拼接注入，非覆盖）
- **技能 & Agent**：标注来源层和是否被项目级覆盖

### 同步中心

将 Claude Code 的工作习惯迁移到 Codex CLI（或反向）：

- **扫描**：自动识别可迁移项（指令、技能、Agent、Hook、设置等）
- **计划**：生成迁移计划，标注每项的状态（可迁移 / 需转换 / 不支持 / 冲突）
- **Dry Run**：预览执行效果，不实际写入文件
- **执行**：确认后一键写入，支持增量或替换模式

### 多项目切换

顶部项目选择器支持：

- **自动发现**：扫描 `~/.claude/projects/` 和 `~/.codex/config.toml` 中记录的项目
- **来源标注**：每个项目标注来自 Claude / Codex / 双侧，显示「上次使用」
- **快速切换**：选择后自动刷新所有配置视图
- **手动指定**：Electron 下使用原生目录选择器，浏览器下输入路径

### 快捷键与命令面板

| 快捷键 | 功能 |
|--------|------|
| `⌘K` | 打开命令面板 — 跨页面、文件、命令的全局模糊搜索与跳转 |
| `⌘R` | 刷新所有数据 |
| `⌘B` | 切换侧栏折叠 |
| `⌘1` / `⌘2` / `⌘3` | 切换模块（概览 / 配置文件 / 同步中心） |
| `/` | 聚焦搜索框 |
| `?` | 打开快捷键速查表 |

### 深色模式

支持浅色 / 深色 / 跟随系统三档切换，通过 CSS 变量驱动全局 token，过渡平滑无闪烁。在「偏好 → 外观」中设置。

### 安全机制

- **路径白名单**：文件写入与删除限制在 `~/.claude/` `~/.codex/` 及当前项目目录内，越权操作返回 403
- **自动备份**：每次写入或删除前，自动生成 `.bak.<YYYYMMDD-HHMMSS>` 备份文件
- **配置导出**：一键将所有配置文件打包为 ZIP（含 MANIFEST 索引），方便备份或迁移
- **纯本地**：所有数据来自本地文件系统，不读取或上传任何远程数据

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + Zustand + Lucide Icons |
| 后端 | Electron IPC + Node.js 文件系统能力 |
| 桌面 | Electron |
| CI/CD | GitHub Actions — 类型检查 + 三端自动打包发布 |

## 本地构建

**前置依赖**

- [Node.js](https://nodejs.org/) 20+
- [Python](https://www.python.org/) 3.10+
- npm

```bash
# 安装前端依赖
npm install

# 安装 Electron 二进制（国内可加镜像加速）
# ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/ node node_modules/electron/install.js

# 开发模式（启动 Vite + Electron）
npm run dev

# Electron 开发模式（需先启动前端或使用 npm run dev）
npm run build:electron
npm run dev:electron

# 生产构建（前端 + Electron 打包）
npm run build
```

### 环境变量

| 名称 | 用途 |
|---|---|
| `CC_STEWARD_PROJECT` | 显式指定项目目录（兼容旧 `CCT_PROJECT`） |
| `CC_STEWARD_DEVTOOLS=1` | Electron 启动时打开 DevTools |

### 端口

| 端口 | 服务 |
|---|---|
| 5174 | Vite 开发服务器 |

## 项目结构

```
├── src/                    # 前端源码
│   ├── core/               #   API 客户端、模块/Agent 注册
│   ├── components/         #   共享 UI 组件（Toast, Badge, Skeleton, CommandPalette...）
│   ├── hooks/              #   共享 Hooks（useAgents, useShortcuts, useTheme...）
│   ├── modules/            #   页面模块（overview, agent-config, sync, settings, help...）
│   ├── store/              #   Zustand 全局状态
│   └── lib/                #   工具函数（retry, shortcut-catalog, electron-bridge）
├── electron/               # Electron 主进程 + preload + IPC 后端
│   └── backend/            #   本地文件扫描、同步、备份、配置解析
├── assets/                 # 应用图标（.icns / .ico / .png）
├── public/                 # 静态资源（SVG favicon）
└── .github/workflows/      # CI + Release 工作流
```

## 文档

- [DESIGN.md](DESIGN.md) — 产品设计文档
- [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) — 实现方案
- [CHANGELOG.md](CHANGELOG.md) — 版本迭代记录

## 作者

[@panbokui](https://github.com/panbokui)

## License

[MIT](LICENSE)
