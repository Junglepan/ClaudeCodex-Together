/** Shared status / scope / format / exists badges used across modules. */

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  active:        { label: '活跃中',   className: 'bg-green-100 text-green-700' },
  not_installed: { label: '未安装',   className: 'bg-gray-100 text-gray-500' },
  partial:       { label: '部分配置', className: 'bg-yellow-100 text-yellow-700' },
}

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { label: status, className: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

export function ExistsBadge({ exists }: { exists: boolean }) {
  return exists ? (
    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">活跃</span>
  ) : (
    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">不存在</span>
  )
}

export function ScopeBadge({ scope }: { scope: string }) {
  return scope === 'global' ? (
    <span className="text-2xs px-1.5 py-0.5 rounded bg-surface-base text-text-tertiary">全局</span>
  ) : (
    <span className="text-2xs px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue">项目</span>
  )
}

const FORMAT_COLORS: Record<string, string> = {
  json: 'text-accent-orange',
  markdown: 'text-accent-blue',
  toml: 'text-accent-purple',
  shell: 'text-accent-green',
  dir: 'text-text-tertiary',
}

export function FormatBadge({ format }: { format: string }) {
  return (
    <span className={`text-2xs uppercase font-mono ${FORMAT_COLORS[format] ?? 'text-text-tertiary'}`}>
      {format}
    </span>
  )
}

export function CountBadge({ active, total }: { active: number; total: number }) {
  if (active === 0) return <span className="text-2xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">未安装</span>
  if (active === total) return <span className="text-2xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">活跃中</span>
  return <span className="text-2xs px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">部分</span>
}
