import { Search } from 'lucide-react'
import type { ApiSessionSearchHit } from '@/core/api'

export function SessionSearch({
  query,
  onQueryChange,
  hits,
  searching,
  onOpenHit,
}: {
  query: string
  onQueryChange: (query: string) => void
  hits: ApiSessionSearchHit[]
  searching: boolean
  onOpenHit: (hit: ApiSessionSearchHit) => void
}) {
  return (
    <div className="border border-border-default bg-surface-card rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border-subtle flex items-center gap-2">
        <Search size={14} className="text-text-tertiary" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索会话内容"
          className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-tertiary"
        />
        {searching && <span className="text-2xs text-text-tertiary">搜索中</span>}
      </div>
      {query.trim() && (
        <div className="max-h-[220px] overflow-auto divide-y divide-border-subtle">
          {hits.length === 0 ? (
            <div className="px-3 py-4 text-sm text-text-tertiary">没有匹配结果</div>
          ) : hits.map((hit) => (
            <button
              key={`${hit.session.id}-${hit.messageId}-${hit.excerpt}`}
              onClick={() => onOpenHit(hit)}
              className="w-full text-left px-3 py-2.5 hover:bg-surface-hover"
            >
              <div className="flex items-center gap-2 text-2xs text-text-tertiary">
                <span>{hit.session.agent}</span>
                <span>{hit.role}</span>
                <span className="truncate">{hit.session.title}</span>
              </div>
              <div className="mt-1 text-xs text-text-secondary line-clamp-2">{hit.excerpt}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
