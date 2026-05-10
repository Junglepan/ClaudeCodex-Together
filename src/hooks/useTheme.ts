import { useEffect } from 'react'
import { useAppStore } from '@/store'

/** Apply persisted theme preference to <html>, listen to OS changes when 'auto'. */
export function useTheme() {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'auto' && mql.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    if (theme === 'auto') {
      mql.addEventListener('change', apply)
      return () => mql.removeEventListener('change', apply)
    }
  }, [theme])
}
