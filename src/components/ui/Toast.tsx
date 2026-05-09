import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'
import { useAppStore } from '@/store'

export function ToastHost() {
  const { toasts, dismissToast } = useAppStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const Icon = t.kind === 'success' ? CheckCircle : t.kind === 'error' ? AlertCircle : Info
        const tone =
          t.kind === 'success' ? 'bg-green-50 border-green-200 text-green-800'
          : t.kind === 'error' ? 'bg-red-50 border-red-200 text-red-800'
          : 'bg-blue-50 border-blue-200 text-blue-800'
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm text-xs animate-toast-in ${tone}`}
            role="status"
          >
            <Icon size={14} className="flex-shrink-0" />
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismissToast(t.id)}
              className="opacity-60 hover:opacity-100 transition-opacity"
              aria-label="关闭"
            >
              <X size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
