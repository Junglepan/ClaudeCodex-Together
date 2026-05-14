# 实现方案 / Implementation

> 每次功能迭代或方案更新后刷新本文档，保持其反映当前实现而非历史。

最近更新：2026-05-13

## 1. 总体架构

```
React Renderer
  ↓ src/core/api.ts
window.cct.api(...)
  ↓ preload.ts / ipcRenderer.invoke("cct:api")
Electron main process
  ↓ electron/backend/*
local filesystem
```

cc-steward 不再启动 Python/FastAPI 后端，也不监听 localhost 业务端口。开发和生产都使用同一套 Electron IPC 后端。

## 2. 后端

后端位于 `electron/backend/`：

- `api.ts`：IPC 请求分发入口。
- `agents.ts`：Claude/Codex 配置定义与文件扫描。
- `files.ts`：文件详情、读取、写入、删除和 hooks 解析。
- `projects.ts`：从 Claude/Codex 本地配置发现项目。
- `config.ts`：解析多层配置的最终生效状态。
- `sync.ts`：Claude 到 Codex 的扫描、计划、dry-run 和执行。
- `backup.ts`：导出配置 ZIP。
- `fsUtils.ts`：文件系统、路径和 JSON/TOML 辅助函数。

## 3. 前端通信

`src/core/api.ts` 保持原有业务方法形状，例如 `api.agents.list()`、`api.files.write()`、`api.sync.plan()`。内部不再使用 `fetch`，而是调用 `electronApi.backend()`。

`electron/preload.ts` 只暴露最小桥接能力，不开启 renderer 的 Node integration。

## 4. 构建

- `npm run dev`：启动 Vite 和 Electron。
- `npm run build:frontend`：构建 React renderer。
- `npm run build:electron`：编译 Electron main/preload/backend。
- `npm run test:backend`：运行 Electron backend TypeScript 测试。
- `npm run build`：完整打包桌面应用。
