import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthStore {
  isAuthenticated: boolean
  adminName: string | null
  token: string | null
  permissions: string[] | null
  can: (permission: string) => boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
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
        return !Array.isArray(permissions) || permissions.includes(permission)
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
      logout: () => {
        void fetch('/api/auth', { method: 'DELETE' })
        set({ isAuthenticated: false, adminName: null, token: null, permissions: null })
      },
      refreshSession: async () => {
        try {
          const response = await fetch('/api/auth', { cache: 'no-store' })
          if (!response.ok) return
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
