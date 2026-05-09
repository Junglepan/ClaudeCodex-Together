# Changelog

记录每一次功能迭代与方案更新。新条目放最前。  
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

---

## [Unreleased] — 2026-05-09 (三)

### 修复
- AgentConfigPage 外层缺 `flex-1 min-w-0`，导致宽窗口下右侧大片留白。`<main>` 为 flex row 容器，子元素需显式声明 `flex-1` 才能撑满剩余宽度

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
