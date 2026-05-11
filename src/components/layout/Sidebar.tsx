import { NavLink } from 'react-router-dom'
import { Shield, Monitor, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { moduleRegistry } from '@/core/module-registry'
import { useAppStore } from '@/store'

export function Sidebar() {
  const modules = moduleRegistry.getNavItems()
  const { platform, sidebarCollapsed } = useAppStore()

  const bottomModules = modules.filter((m) => ['settings', 'help'].includes(m.id))
  const mainModules   = modules.filter((m) => !['settings', 'help'].includes(m.id))
  const ungrouped = mainModules.filter((m) => !m.group)
  const groupNames = Array.from(new Set(mainModules.filter((m) => m.group).map((m) => m.group!)))

  const widthClass = sidebarCollapsed ? 'w-[58px]' : 'w-[164px]'

  return (
    <aside
      className={`${widthClass} flex-shrink-0 bg-surface-base border-r border-border-default flex flex-col select-none transition-[width] duration-200 ease-out`}
    >
      <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto overflow-x-hidden">
        {ungrouped.map((mod) => (
          <NavItem key={mod.id} mod={mod} collapsed={sidebarCollapsed} />
        ))}
        {groupNames.map((group) => (
          <NavSection
            key={group}
            label={group}
            items={mainModules.filter((m) => m.group === group)}
            collapsed={sidebarCollapsed}
          />
        ))}
      </nav>

      <div className={`pb-4 space-y-2.5 ${sidebarCollapsed ? 'px-1.5' : 'px-3'}`}>
        {!sidebarCollapsed && (
          <div className="flex items-start gap-1.5 p-2.5 bg-accent-blue/5 border border-accent-blue/15 rounded-lg animate-fade-in">
            <Shield size={12} className="text-accent-blue mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-2xs font-medium text-accent-blue">仅本地文件</p>
              <p className="text-2xs text-text-tertiary mt-0.5 leading-relaxed">
                所有数据均来自本地文件系统。
              </p>
            </div>
          </div>
        )}

        {!sidebarCollapsed ? (
          <div className="flex items-center gap-1.5 px-1">
            <Monitor size={11} className="text-text-tertiary" />
            <span className="text-2xs text-text-tertiary">本机</span>
            <span className="ml-auto flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-status-active inline-block" />
              <span className="text-2xs text-text-tertiary truncate max-w-[80px]">{platform ?? 'Local'}</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center" title={platform ?? 'Local'}>
            <span className="w-1.5 h-1.5 rounded-full bg-status-active inline-block" />
          </div>
        )}

        {bottomModules.length > 0 && (
          <div className="pt-1 border-t border-border-subtle space-y-0.5">
            {bottomModules.map((mod) => (
              <NavLink
                key={mod.id}
                to={mod.path}
                title={sidebarCollapsed ? mod.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-2 ${sidebarCollapsed ? 'justify-center' : 'px-2'} py-1.5 rounded-lg text-xs transition-colors ${
                    isActive ? 'text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
                  }`
                }
              >
                <mod.Icon size={13} />
                {!sidebarCollapsed && mod.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function NavItem({
  mod,
  collapsed,
}: {
  mod: ReturnType<typeof moduleRegistry.getNavItems>[number]
  collapsed: boolean
}) {
  return (
    <NavLink
      to={mod.path}
      title={collapsed ? mod.label : undefined}
      className={({ isActive }) =>
        `group flex items-center gap-2.5 ${collapsed ? 'justify-center px-0' : 'px-3'} py-2 rounded-lg text-sm transition-all ${
          isActive
            ? 'bg-surface-active text-text-primary font-medium'
            : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <mod.Icon
            size={15}
            className={`${isActive ? 'text-accent-blue' : 'text-text-tertiary group-hover:text-text-secondary'} transition-colors flex-shrink-0`}
          />
          {!collapsed && <span className="truncate">{mod.label}</span>}
        </>
      )}
    </NavLink>
  )
}

function NavSection({
  label,
  items,
  collapsed,
}: {
  label: string
  items: ReturnType<typeof moduleRegistry.getNavItems>
  collapsed: boolean
}) {
  const [expanded, setExpanded] = useState(true)

  if (collapsed) {
    return (
      <div className="mt-2 pt-2 border-t border-border-subtle space-y-0.5">
        {items.map((mod) => <NavItem key={mod.id} mod={mod} collapsed={true} />)}
      </div>
    )
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-2xs font-semibold text-text-tertiary uppercase tracking-wider hover:text-text-secondary transition-colors rounded-lg hover:bg-surface-hover"
      >
        <ChevronDown
          size={10}
          className={`transition-transform ${expanded ? '' : '-rotate-90'}`}
        />
        {label}
      </button>
      {expanded && (
        <div className="mt-0.5 space-y-0.5 pl-2 animate-fade-in">
          {items.map((mod) => (
            <NavLink
              key={mod.id}
              to={mod.path}
              className={({ isActive }) =>
                `group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'bg-surface-active text-text-primary font-medium'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <mod.Icon
                    size={14}
                    className={`${isActive ? 'text-accent-blue' : 'text-text-tertiary group-hover:text-text-secondary'} transition-colors flex-shrink-0`}
                  />
                  <span className="truncate">{mod.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}
