'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStoredUser, clearAuth, isLoggedIn } from '../_lib/auth'
import { logout, type AuthUser } from '../_lib/api/client'

const navItems = [
  { href: '/', label: 'ダッシュボード', icon: '⊞' },
  { href: '/daily-order', label: '食数発注', icon: '📋' },
  { href: '/menus', label: '献立管理', icon: '📅' },
  { href: '/menu-master', label: 'メニュー管理', icon: '🍽' },
  { href: '/order-sheets', label: '発注書出力', icon: '📄' },
  { href: '/coop-order',   label: '生協発注',   icon: '🛒' },
  { href: '/menu-table',   label: '献立表出力', icon: '📋' },
  { href: '/master', label: 'マスタ管理', icon: '⚙' },
  { href: '/users', label: 'ユーザー管理', icon: '👤' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const noShellPaths = ['/login', '/400', '/500']
  const isNoShellPath = pathname !== null && noShellPaths.includes(pathname)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checking, setChecking] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (isNoShellPath) {
      setChecking(false)
      return
    }
    if (!isLoggedIn()) {
      router.replace('/login')
      return
    }
    setUser(getStoredUser())
    setChecking(false)
  }, [isNoShellPath, pathname, router])

  const handleLogout = async () => {
    try { await logout() } catch { /* ignore */ }
    clearAuth()
    router.push('/login')
  }

  // ログインページはシェルなし
  if (isNoShellPath) {
    return <>{children}</>
  }

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#666' }}>読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="app-layout" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* サイドバー */}
      <aside className="app-sidebar" style={{
        width: 240,
        background: 'linear-gradient(180deg, #1a3a5c 0%, #0d2137 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
        boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
        transform: sidebarOpen ? 'translateX(0)' : undefined,
      }}>
        {/* ロゴエリア */}
        <div style={{
          padding: '1.5rem 1.25rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 36,
              height: 36,
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
            }}>📋</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>食数発注</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>管理システム</div>
            </div>
          </div>
        </div>

        {/* ナビゲーション */}
        <nav style={{ flex: 1, padding: '0.75rem 0.75rem' }}>
          {navItems.map(({ href, label, icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.7rem 0.75rem',
                  borderRadius: 8,
                  marginBottom: '0.25rem',
                  background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                  textDecoration: 'none',
                  fontWeight: active ? 600 : 400,
                  fontSize: '0.9rem',
                  transition: 'all 0.15s',
                  borderLeft: active ? '3px solid #4fc3f7' : '3px solid transparent',
                }}
              >
                <span style={{ fontSize: '1rem', minWidth: 20, textAlign: 'center' }}>{icon}</span>
                {label}
              </Link>
            )
          })}
        </nav>

        {/* ユーザー情報 */}
        <div style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <div style={{
              width: 32,
              height: 32,
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              color: '#fff',
              fontWeight: 700,
            }}>
              {user?.name?.charAt(0) ?? '?'}
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{user?.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>
                {user?.role === 'admin' ? '管理者' : 'ユーザー'}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '0.5rem',
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            ログアウト
          </button>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <div className="app-main-wrapper" style={{ flex: 1, marginLeft: 240, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* ヘッダー */}
        <header className="app-header" style={{
          background: '#fff',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 2rem',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#374151' }}>
            {navItems.find((n) => n.href === pathname)?.label ?? 'ページ'}
          </h1>
          <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>
            {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
          </div>
        </header>

        {/* ページコンテンツ */}
        <main className="app-main" style={{ flex: 1, padding: '2rem' }}>
          {children}
        </main>

        {/* フッター */}
        <footer className="app-footer" style={{
          background: '#fff',
          borderTop: '1px solid #e2e8f0',
          padding: '0.75rem 2rem',
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: '0.8rem',
        }}>
          食数発注システム © {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  )
}
