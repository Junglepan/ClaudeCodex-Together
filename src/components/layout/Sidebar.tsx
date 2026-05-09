import { NavLink } from 'react-router-dom'
import { Shield, Monitor } from 'lucide-react'
import { moduleRegistry } from '@/core/module-registry'
import { useAppStore } from '@/store'

export function Sidebar() {
  const modules = moduleRegistry.getNavItems()
  const { platform } = useAppStore()

  // Split modules: main nav vs bottom nav (e.g. settings/help)
  const mainModules = modules.filter((m) => !['settings', 'help'].includes(m.id))
  const bottomModules = modules.filter((m) => ['settings', 'help'].includes(m.id))

  return (
    <aside className="w-[160px] flex-shrink-0 bg-surface-base border-r border-border-default flex flex-col select-none">
      {/* Main nav */}
      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {mainModules.map((mod) => (
          <NavLink
            key={mod.id}
            to={mod.path}
            end={mod.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-white shadow-sm text-text-primary font-medium'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <mod.Icon
                  size={16}
                  className={isActive ? 'text-accent-blue' : 'text-text-tertiary'}
                />
                {mod.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom info */}
      <div className="px-3 pb-4 space-y-3">
        {/* Local-only badge */}
        <div className="flex items-start gap-2 p-2.5 bg-accent-blue/5 border border-accent-blue/15 rounded-lg">
          <Shield size={13} className="text-accent-blue mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-2xs font-medium text-accent-blue">仅本地文件</p>
            <p className="text-2xs text-text-tertiary mt-0.5 leading-relaxed">
              所有配置和数据均来源于本地文件系统，不会读取或上传任何远程数据。
            </p>
          </div>
        </div>

        {/* Platform info */}
        <div className="flex items-center gap-1.5 px-1">
          <Monitor size={11} className="text-text-tertiary" />
          <span className="text-2xs text-text-tertiary">本机</span>
          <span className="ml-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-status-active inline-block" />
          </span>
          <span className="text-2xs text-text-tertiary">{platform ?? 'Local'}</span>
        </div>

        {/* Bottom modules (settings, help) */}
        {bottomModules.length > 0 && (
          <div className="space-y-0.5">
            {bottomModules.map((mod) => (
              <NavLink
                key={mod.id}
                to={mod.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                    isActive ? 'text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
                  }`
                }
              >
                <mod.Icon size={13} />
                {mod.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
