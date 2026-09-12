import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { hasPermission } from '@/lib/admin-permissions'

interface AuthStore {
  isAuthenticated: boolean
  adminName: string | null
  token: string | null
  permissions: string[] | null
  can: (permission: string) => boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      adminName: null,
      token: null,
      permissions: null,
      can: (permission) => {
        const permissions = get().permissions
        return get().isAuthenticated && hasPermission(permissions, permission)
      },
      login: async (username: string, password: string) => {
        try {
          const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          })
          if (res.ok) {
            const data = await res.json()
            set({ isAuthenticated: true, adminName: data.name, token: null, permissions: data.permissions ?? null })
            return true
          }
          return false
        } catch {
          return false
        }
      },
      logout: async () => {
          try {
            if ('serviceWorker' in navigator) {
              const registration = await navigator.serviceWorker.getRegistration('/admin')
              const sub = await registration?.pushManager.getSubscription()
              if (sub) {
                // Stop this browser locally even if the backend is temporarily unreachable.
                await sub.unsubscribe()
                await fetch('/api/admin-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disable', subscription: sub.toJSON() }), signal: AbortSignal.timeout(5000) })
              }
            }
          } catch { /* Expired endpoints are also removed when the push provider returns 410. */ }
          finally { await fetch('/api/auth', { method: 'DELETE' }).catch(() => undefined) }
        set({ isAuthenticated: false, adminName: null, token: null, permissions: null })
      },
      refreshSession: async () => {
        try {
          const response = await fetch('/api/auth', { cache: 'no-store' })
          if (!response.ok) {
            if (response.status === 401 || response.status === 403) set({ isAuthenticated: false, adminName: null, token: null, permissions: [] })
            return
          }
          const data = await response.json()
          set({ isAuthenticated: true, adminName: data.name, token: null, permissions: data.permissions ?? null })
        } catch {
          // Keep the current UI state during temporary network failures.
        }
      },
    }),
    {
      name: 'famar-auth',
      version: 2,
      // La sesión anterior vivía en localStorage. Se cierra una sola vez para
      // trasladarla a la cookie HttpOnly, que JavaScript no puede leer ni robar.
      migrate: () => ({ isAuthenticated: false, adminName: null, token: null, permissions: null }),
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated, adminName: state.adminName, permissions: state.permissions }),
    }
  )
)
