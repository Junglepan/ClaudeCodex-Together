import { File } from 'lucide-react'

export function Skeleton({ className = '', rounded = 'rounded-md' }: { className?: string; rounded?: string }) {
  return <div className={`animate-pulse bg-border-subtle/70 ${rounded} ${className}`} />
}

export function CardSkeleton() {
  return (
    <div className="bg-surface-card border border-border-default rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="w-7 h-7" rounded="rounded-lg" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2 w-32" />
        </div>
        <Skeleton className="h-4 w-14" rounded="rounded-full" />
      </div>
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border-subtle">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="w-2 h-2" rounded="rounded-full" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 flex-1 max-w-xs" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon = File, title, hint }: { icon?: typeof File; title: string; hint?: string }) {
  return (
    <div className="flex items-center justify-center h-full text-text-tertiary py-12">
      <div className="text-center">
        <Icon size={28} className="mx-auto mb-2 opacity-25" />
        <p className="text-sm">{title}</p>
        {hint && <p className="text-2xs mt-1 text-text-tertiary/80">{hint}</p>}
      </div>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
      <span className="text-base">⚠️</span>
      <div className="flex-1">
        <p className="font-medium">加载失败</p>
        <p className="text-xs mt-0.5 text-red-500/90">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs px-3 py-1 border border-red-300 rounded-lg hover:bg-red-100 transition-colors"
        >
          重试
        </button>
      )}
    </div>
  )
}
