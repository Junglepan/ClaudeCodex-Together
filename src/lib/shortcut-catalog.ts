/**
 * Single source of truth for shortcut documentation.
 * Actual key handlers live in src/App.tsx (GlobalShortcuts) and component-local hotkeys;
 * this file is read by Settings + Help to render reference tables.
 */

export interface ShortcutEntry {
  id: string
  keys: string          // human-readable, e.g. "⌘R"
  label: string
  description: string
  scope: '全局' | '编辑器' | '搜索框'
}

export const SHORTCUTS: ShortcutEntry[] = [
  { id: 'refresh',    keys: '⌘ R',     label: '刷新数据',    description: '重新拉取 agent 摘要与全部文件', scope: '全局' },
  { id: 'sidebar',    keys: '⌘ B',     label: '折叠侧栏',    description: '展开/收起左侧导航',          scope: '全局' },
  { id: 'goOverview', keys: '⌘ 1',     label: '前往概览',    description: '跳转到概览页',              scope: '全局' },
  { id: 'goFiles',    keys: '⌘ 2',     label: '前往配置文件', description: '跳转到配置文件页',          scope: '全局' },
  { id: 'goSync',     keys: '⌘ 3',     label: '前往同步中心', description: '跳转到同步中心',            scope: '全局' },
  { id: 'focusSearch',keys: '/',       label: '聚焦搜索',     description: '把光标移入当前页搜索框',     scope: '全局' },
  { id: 'save',       keys: '⌘ S',     label: '保存',         description: '保存当前编辑的内容',         scope: '编辑器' },
  { id: 'cancel',     keys: 'Esc',     label: '取消编辑',     description: '退出编辑模式或关闭对话',     scope: '编辑器' },
]
