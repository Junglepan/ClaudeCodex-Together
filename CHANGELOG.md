# Changelog

记录每一次功能迭代与方案更新。新条目放最前。  
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

---

## [Unreleased] — 2026-05-11

### 修复
- 默认项目路径恢复为用户 home 目录，同时 Electron 文件监听只监听 Claude/Codex 配置路径，避免递归监听整个 home。
- Electron 文件变动触发的后台刷新不再弹出“已刷新”成功 toast，并增加 300ms 防抖，避免刷新弹窗堆叠。
- 配置生效树：指令加载文案改为“全部拼接注入”，避免误导为覆盖关系。
- Codex resolved agents 扫描改为读取 `.toml` 文件，并在缺少 `tomllib/tomli` 时优雅降级。
- Claude resolved settings 对 `hooks` / `permissions` 使用多层追加合并，标记为“多层合并”。
- `/meta` 无项目环境变量时不再把 home 目录误设为当前项目。
- `/projects` 增加 `last_used` 并按最近使用排序；同路径 Claude/Codex 来源合并为 `both` 时保留最新时间。

### 改进
- ProjectSelector 首次无自动发现项目时显示引导文案，并为最近使用的发现项目标注“上次使用”。
- Help 新增“Claude Code 配置关系与优先级”章节；Agent 总览页移除静态关系树，配置生效树增加跳转入口。

---

## [Unreleased] — 2026-05-10

### 新增
- **图标多格式产物**
  - `assets/icon.icns`（1.7 MB，10 档 retina sizes，由 `iconutil` 生成）
  - `assets/icon.ico`（79 KB，6 档 16-256，由 PIL 生成）
  - `public/icon.svg`（矢量，作为深色/小尺寸 favicon 主源；PNG 仍作为兜底）
- electron-builder 三端图标分别指向 `.icns` / `.ico` / `.png`，打包时直出原生格式
- `index.html` favicon 链优先 SVG，回退 PNG

---

## [Unreleased] — 2026-05-09 (七)

### 新增
- **应用图标**：双弧 + 桥点（Claude 蓝 / Codex 绿，居中圆点 = steward）
- 落地：`public/icon.png` (favicon) + `assets/icon.png` (Electron BrowserWindow.icon)
- electron-builder：`build.mac/win/linux.icon` 指向 `assets/icon.png`

---

## [Unreleased] — 2026-05-09 (六)

### 改名
- 工具更名 `cct` → **`cc-steward`**（"Claude / Codex Steward"，配置管家）
- 涉及：`package.json` (name/appId/productName)、`index.html` 标题、TitleBar 主标 + 副标、Settings Project/Shortcuts/About 节、ZIP 导出文件名、`README.md` 重写、`backend/main.py` FastAPI 标题
- 环境变量：主名改为 `CC_STEWARD_PROJECT` / `CC_STEWARD_DEVTOOLS`，旧 `CCT_PROJECT` / `CCT_DEVTOOLS` 仍兼容
- 仓库目录路径暂未改名（`ClaudeCodex-Together`），后续可单独迁移

---

## [Unreleased] — 2026-05-09 (五)

### 修复
- Electron 重启的冷启动窗口期 vite 代理拿到 ECONNREFUSED → 前端误报 "API 500"。新增 `src/lib/retry.ts::withColdStartRetry`，识别网络/5xx 类错误并退避重试（最多 5 次，最长 2.5s）。useAgents/useAgentFiles/TitleBar/GlobalShortcuts 的刷新链路全部接入

---

## [Unreleased] — 2026-05-09 (四)

### 新增
- **⌘K 命令面板**：跨页面/文件/命令的全局搜索与跳转，支持 ↑↓ 选择 ↵ 执行 Esc 关闭
- **? 快捷键速查弹层**：随时按 `?` 调出全部快捷键
- **TitleBar 后端心跳指示灯**：每 5 秒探测 `/health`，绿/灰/红
- **Electron IPC 系统集成**：在 Finder 显示、在终端打开、原生目录选择器；FileDetail 路径行加按钮；Settings 项目页支持切换目录
- **深色模式**：浅 / 深 / 跟随系统三档（持久化），通过 CSS 变量驱动 token，过渡 200ms
- **安全写入**：后端文件写入与删除限制在 `~/.claude/` `~/.codex/` `~/.agents/` 与当前项目目录；越权返回 403
- **自动备份**：写入与删除前自动复制为 `.bak.<YYYYMMDD-HHMMSS>` 同目录文件
- **配置导出**：`GET /backup/export` 返回 ZIP（含 MANIFEST.txt 索引）；Settings → 备份与导出 一键下载

### 修复
- FileDetail "前往同步中心" 按钮真正跳转 `/sync`

---

## [Unreleased] — 2026-05-09 (三)

### 修复
- AgentConfigPage 外层缺 `flex-1 min-w-0`，导致宽窗口下右侧大片留白
- `OverviewTab` 用 `flex-1 overflow-auto`，但父级不是 flex 容器，`flex-1` 失效导致高度按内容撑开、永不触发滚动 → 改为 `h-full overflow-auto`
- 自定义滚动条加宽到 10px，颜色更明显（`#C7C7CC`，hover 变深），并补 Firefox 的 `scrollbar-width/scrollbar-color`，避免 macOS 默认隐藏式滚动条看不见的问题

---

## [Unreleased] — 2026-05-09 (二)

### 改动
- **新增模块**：`偏好`（Settings）— 左侧分区（外观/快捷键/运行环境/关于），TitleBar 偏好按钮接通；持久化的折叠侧栏开关；快捷键参考表；后端探测信息（含可一键复制路径）；版本与 GitHub 链接
- **Help 模块重构**：左侧锚点目录，IntersectionObserver 高亮当前章节；新增"当前环境"卡片、"键盘快捷键"参考、"已注册的 Agent"可点击跳转；卡片化每一节，hover 与过渡统一
- **共享层**：新增 `src/lib/shortcut-catalog.ts` 作为快捷键单一信源（Settings 与 Help 共用）

### 文档
- 合入 `DESIGN.md`（来自远程）
- `IMPLEMENTATION.md` 同步更新模块目录与共享层

---

## [Unreleased] — 2026-05-09

### 改动
- **架构**：抽 `useAgents` / `useAgentFiles` / `useShortcuts` hooks；新增 `components/ui/{Badges,Skeleton,Toast}` 共享层；store 增加 `loading/refreshing/error/toasts/sidebarCollapsed`，sidebar 状态持久化到 localStorage
- **交互**：全局 Toast 替代散落的 banner；快捷键 ⌘R 刷新、⌘B 折叠侧栏、⌘1/2/3 切换模块、`/` 聚焦搜索、编辑器 ⌘S/Esc；刷新按钮带 spin + disabled
- **布局**：侧栏可折叠到 58px 图标条；骨架屏（CardSkeleton / TableSkeleton）替代 "加载中…"；fade-in / toast-in 动画
- **视觉**：统一 `:focus-visible` 蓝色环；Electron 下隐藏自绘 traffic-light 让出原生位置；`drag-region` 整条标题栏可拖
- **数据通路**：移除 `src/core/mock-data.ts`（533 行）及 `isMockMode/probeBackend/FORCE_MOCK` 状态机；接口只走真实 backend，失败直接抛错由调用方 toast。修复一次探测失败即锁定 mock 的 Bug
- **基础设施**：dev 端口由 5173 改为 5174（与本机其他项目冲突）；`build:electron` 自动写入 `dist-electron/package.json` 标记 commonjs；DevTools 默认关闭，`CCT_DEVTOOLS=1` 启用并 detach 显示
- **App 启动**：`api.meta()` 加指数退避重试（300ms → 3s，最多 8 次），覆盖 Electron 冷启动期 backend 未就绪的窗口

### 已知问题 / 后续
- Electron 打包流程未验证（`npm run build` 仅在 dev 模式跑过）
- 同步中心暂未连接 FileDetail 的"前往同步中心"按钮跳转
- Settings/Help 模块只有占位

---

## [0.1.0] — 2026-05-08

初始版本。

### 功能
- 配置管理三级层次结构：Claude / Codex agent → 配置文件 → 文件详情
- 文件 CRUD：读、写、删除
- 同步中心：plan / dry-run / execute
- 文件对照表与配置关系树

### 模块
- Overview / 当前生效 / Claude / Codex / 同步中心 / 帮助 / 配置文件
- backend FastAPI + frontend React + Electron

详见提交 `42ef2d8` `317f3b8` `9186160` `7d128f9` `d4955b4`。
