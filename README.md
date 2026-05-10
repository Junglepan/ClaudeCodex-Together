# cc-steward

> Claude Code / Codex CLI 本地配置管家

cc-steward 是一个本地桌面工具，帮助同时使用 Claude Code 和 Codex CLI 的开发者：

- **可视化理解**两个工具的所有配置文件：路径、格式、作用、优先级、合并策略
- **感知当前状态**：哪些文件已存在、哪些尚未创建、各文件当前内容
- **直接管理**配置文件：在工具内直接编辑、新建、删除
- **工作习惯同步**：把 Claude Code 的指令、Skills、Agents 迁移适配到 Codex

**核心约束：所有数据来自本地文件系统，不读取或上传任何远程数据。**

详见 [DESIGN.md](DESIGN.md) · [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) · [CHANGELOG.md](CHANGELOG.md)。

## 快速开始

```bash
# 安装依赖（首次）
npm install
python3 -m pip install -r backend/requirements.txt
node node_modules/electron/install.js  # 国内可加 ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/

# 启动开发模式
npm run dev:frontend                       # vite 在 5174
NODE_ENV=development npx electron dist-electron/main.js   # Electron 自带后端
```

## 端口与环境变量

| 名称 | 用途 |
|---|---|
| 5174 | Vite dev server |
| 8765 | FastAPI 后端 |
| `CC_STEWARD_PROJECT` | 显式指定项目目录（兼容旧 `CCT_PROJECT`） |
| `CC_STEWARD_DEVTOOLS=1` | Electron 启动时打开 DevTools |
