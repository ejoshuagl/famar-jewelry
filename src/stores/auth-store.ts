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
            set({ isAuthenticated: true, adminName: data.name, token: data.token, permissions: data.permissions ?? null })
            return true
          }
          return false
        } catch {
          return false
        }
      },
      logout: () => {
        set({ isAuthenticated: false, adminName: null, token: null, permissions: null })
      },
    }),
    {
      name: 'famar-auth',
    }
  )
)
