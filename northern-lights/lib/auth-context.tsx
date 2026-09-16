'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AuthResponse, UserRole } from '@/lib/auth-api'
import { apiRequest } from '@/lib/api'

export type AppUserRole = UserRole | 'admin'

export type CurrentUser = {
  id: string
  name: string
  email: string
  role: AppUserRole
}

type AuthContextValue = {
  user: CurrentUser | null
  role: AppUserRole | null
  isAuthenticated: boolean
  setUser: (user: CurrentUser | null) => void
  setUserFromAuth: (response: AuthResponse) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    apiRequest<{ authenticated: boolean; user: CurrentUser | null }>('/api/session')
      .then((result) => setUser(result.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true))
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    role: user?.role ?? null,
    isAuthenticated: Boolean(user),
    setUser,
    setUserFromAuth: (response) => setUser(response.user),
    signOut: () => {
      void apiRequest('/api/logout', { method: 'POST' }).finally(() => setUser(null))
    },
  }), [user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}

export function useRequireRole(...allowedRoles: AppUserRole[]) {
  const auth = useAuth()
  const hasAccess = auth.role ? allowedRoles.includes(auth.role) : false

  return { ...auth, hasAccess }
}

// API integration point: call setUserFromAuth() after your sign-in response.
// Example: const result = await authenticate(payload); setUserFromAuth(result)
