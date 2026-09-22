import { describe, it, expect, beforeEach } from 'vitest'
import { saveAuth, clearAuth, getStoredUser, getStoredToken, isLoggedIn } from '../../app/_lib/auth'
import type { AuthUser } from '../../app/_lib/api/client'

const mockUser: AuthUser = {
  id: 1,
  name: 'テストユーザー',
  role: 'user',
  block_id: null,
}

describe('auth', () => {
  beforeEach(() => {
    localStorage.clear()
    // Cookieをクリア
    document.cookie.split(';').forEach((c) => {
      document.cookie = c.trim().split('=')[0] + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'
    })
  })

  // ── saveAuth ──────────────────────────────────────────────────────────────

  describe('saveAuth', () => {
    it('localStorageにトークンを保存する', () => {
      saveAuth('mytoken123', mockUser)
      expect(localStorage.getItem('auth_token')).toBe('mytoken123')
    })

    it('localStorageにユーザー情報を保存する', () => {
      saveAuth('mytoken123', mockUser)
      const stored = JSON.parse(localStorage.getItem('auth_user')!)
      expect(stored).toEqual(mockUser)
    })

    it('Cookieにトークンを保存する', () => {
      saveAuth('mytoken123', mockUser)
      expect(document.cookie).toContain('auth_token')
    })
  })

  // ── clearAuth ─────────────────────────────────────────────────────────────

  describe('clearAuth', () => {
    it('localStorageからトークンを削除する', () => {
      saveAuth('mytoken123', mockUser)
      clearAuth()
      expect(localStorage.getItem('auth_token')).toBeNull()
    })

    it('localStorageからユーザー情報を削除する', () => {
      saveAuth('mytoken123', mockUser)
      clearAuth()
      expect(localStorage.getItem('auth_user')).toBeNull()
    })
  })

  // ── getStoredToken ────────────────────────────────────────────────────────

  describe('getStoredToken', () => {
    it('保存されたトークンを返す', () => {
      localStorage.setItem('auth_token', 'abc123')
      expect(getStoredToken()).toBe('abc123')
    })

    it('トークンがなければnullを返す', () => {
      expect(getStoredToken()).toBeNull()
    })
  })

  // ── getStoredUser ─────────────────────────────────────────────────────────

  describe('getStoredUser', () => {
    it('保存されたユーザーを返す', () => {
      localStorage.setItem('auth_user', JSON.stringify(mockUser))
      const user = getStoredUser()
      expect(user).toEqual(mockUser)
    })

    it('ユーザーがなければnullを返す', () => {
      expect(getStoredUser()).toBeNull()
    })

    it('不正なJSONはnullを返す', () => {
      localStorage.setItem('auth_user', '{invalid json}')
      expect(getStoredUser()).toBeNull()
    })
  })

  // ── isLoggedIn ────────────────────────────────────────────────────────────

  describe('isLoggedIn', () => {
    it('トークンがあればtrueを返す', () => {
      localStorage.setItem('auth_token', 'sometoken')
      expect(isLoggedIn()).toBe(true)
    })

    it('トークンがなければfalseを返す', () => {
      expect(isLoggedIn()).toBe(false)
    })

    it('saveAuth後はtrueになる', () => {
      saveAuth('tok', mockUser)
      expect(isLoggedIn()).toBe(true)
    })

    it('clearAuth後はfalseになる', () => {
      saveAuth('tok', mockUser)
      clearAuth()
      expect(isLoggedIn()).toBe(false)
    })
  })
})
