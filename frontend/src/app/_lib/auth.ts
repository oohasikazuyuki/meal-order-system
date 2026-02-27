'use client'

import { type AuthUser } from './api/client'

const COOKIE_NAME = 'auth_token'
const COOKIE_DAYS = 30

function setCookie(name: string, value: string, days: number): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}

export function saveAuth(token: string, user: AuthUser): void {
  localStorage.setItem('auth_token', token)
  localStorage.setItem('auth_user', JSON.stringify(user))
  setCookie(COOKIE_NAME, token, COOKIE_DAYS)
}

export function clearAuth(): void {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_user')
  deleteCookie(COOKIE_NAME)
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('auth_user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

export function isLoggedIn(): boolean {
  return !!getStoredToken()
}
