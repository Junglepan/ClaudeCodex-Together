<!-- LOGO -->
<h1>
<p align="center">
  <img src="assets/icon.png" alt="cc-steward" width="128">
  <br>cc-steward
</h1>
  <p align="center">
    Claude Code / Codex CLI 本地配置管家 — 可视化管理、对照、同步两套 AI 编程工具的全部配置。
    <br />
    <a href="#下载">下载</a>
    ·
    <a href="#功能">功能</a>
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

## 预览

<!-- TODO: 添加应用截图 -->
<!-- ![preview](docs/preview.png) -->

## 下载

前往 [Releases](https://github.com/Junglepan/ClaudeCodex-Together/releases) 下载最新版本：

| 平台 | 文件 |
|------|------|
| macOS (Apple Silicon) | `cc-steward-x.x.x-arm64.dmg` |
| Windows x64 | `cc-steward.Setup.x.x.x.exe` |
| Linux x64 | `cc-steward-x.x.x.AppImage` |

**macOS 首次打开提示"已损坏"或"无法验证开发者"：**

```bash
xattr -cr /Applications/cc-steward.app
```

执行后直接双击打开即可。

## 功能

- **配置可视化**：以统一视图展示 Claude Code 和 Codex CLI 的所有配置文件，路径、格式、作用一目了然
- **配置对照表**：并排对比两套工具的同类配置（指令、技能、Agent、设置），标注同步状态
- **配置生效树**：展示全局 → 项目 → 本地覆写的多层合并逻辑，理解最终生效值
- **文件管理**：直接在工具内查看、编辑、新建、删除配置文件，自动备份
- **同步中心**：将 Claude Code 的指令、Skills、Agents 一键迁移适配到 Codex，支持 dry-run 预览
- **多项目切换**：自动发现已使用过的项目目录，一键切换上下文
- **⌘K 命令面板**：跨页面、文件、命令的全局搜索与快速跳转
- **深色模式**：浅色 / 深色 / 跟随系统三档，CSS 变量驱动零闪烁
- **安全写入**：路径白名单 + 写入前自动 `.bak` 备份，配置导出为 ZIP
- **纯本地**：所有数据来自本地文件系统，不读取或上传任何远程数据

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + Zustand + Lucide Icons |
| 后端 | FastAPI (Python) |
| 桌面 | Electron |
| CI/CD | GitHub Actions — 类型检查 + 三端打包发布 |

## 本地构建

**前置依赖**

- [Node.js](https://nodejs.org/) 20+
- [Python](https://www.python.org/) 3.10+
- npm

```bash
# 安装依赖
npm install
python3 -m pip install -r backend/requirements.txt

# 安装 Electron 二进制（国内可加镜像加速）
# ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/ node node_modules/electron/install.js

# 开发模式（同时启动前端 + 后端）
npm run dev

# Electron 开发模式（需先启动 npm run dev）
npm run build:electron
npm run dev:electron

# 生产构建
npm run build
```

## 环境变量

| 名称 | 用途 |
|---|---|
| `CC_STEWARD_PROJECT` | 显式指定项目目录（兼容旧 `CCT_PROJECT`） |
| `CC_STEWARD_DEVTOOLS=1` | Electron 启动时打开 DevTools |

## 使用

1. 启动后在顶部项目选择器中选择或指定项目目录
2. 在「概览」页查看 Claude Code / Codex CLI 的配置状态与对照表
3. 在「配置管理」中浏览、编辑各级配置文件
4. 在「同步中心」将一侧的配置迁移到另一侧
5. 按 `⌘K` 打开命令面板快速跳转，按 `?` 查看所有快捷键

## 文档

- [DESIGN.md](DESIGN.md) — 产品设计文档
- [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) — 实现方案
- [CHANGELOG.md](CHANGELOG.md) — 版本迭代记录

## 作者

[@panbokui](https://github.com/panbokui)

## License

[MIT](LICENSE)
