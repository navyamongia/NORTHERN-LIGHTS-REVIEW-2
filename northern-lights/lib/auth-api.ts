export type UserRole = 'donor' | 'ngo' | 'admin'

export type AuthPayload = {
  mode: 'signin' | 'signup'
  role: UserRole
  name?: string
  email: string
  password: string
}

export type AuthResponse = {
  user: {
    id: string
    name: string
    email: string
    role: UserRole
  }
  token?: string
}

import { apiRequest } from '@/lib/api'

export async function authenticate(payload: AuthPayload): Promise<AuthResponse> {
  const endpoint = payload.mode === 'signin' ? '/api/login' : '/api/register'
  const body = payload.mode === 'signin'
    ? {
        email: payload.email,
        password: payload.password,
        role: payload.role,
      }
    : {
        name: payload.name,
        email: payload.email,
        password: payload.password,
        role: payload.role,
      }

  return apiRequest<AuthResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// Set NEXT_PUBLIC_API_BASE_URL to your Flask server origin, for example:
// NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:5000
// Uses POST /api/login and POST /api/register with Flask session cookies.
