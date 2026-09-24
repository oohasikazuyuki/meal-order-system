'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStoredUser, clearAuth, isLoggedIn } from '../_lib/auth'
import { logout, type AuthUser } from '../_lib/api/client'

type NavItem = { href: string; label: string }

const navGroups: { group: string; items: NavItem[] }[] = [
  {
    group: '毎日の作業',
    items: [
      { href: '/', label: '今日の状況' },
      { href: '/daily-order', label: '食数を入力' },
      { href: '/menus', label: '献立を組む' },
    ],
  },
  {
    group: '紙に出す',
    items: [
      { href: '/order-sheets', label: '発注書' },
      { href: '/coop-order', label: '生協発注' },
      { href: '/menu-table', label: '献立表' },
    ],
  },
  {
    group: '登録内容',
    items: [
      { href: '/menu-master', label: 'メニューと材料' },
      { href: '/master', label: '部屋・ブロック・仕入先' },
      { href: '/users', label: '利用者' },
    ],
  },
]

const allItems = navGroups.flatMap((g) => g.items)

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const noShellPaths = ['/login', '/400', '/500']
  const isNoShellPath = pathname !== null && noShellPaths.includes(pathname)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checking, setChecking] = useState(true)
  const [today, setToday] = useState('')

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      })
    )
  }, [])

  useEffect(() => {
    if (isNoShellPath) {
      setChecking(false)
      return
    }
    if (!isLoggedIn()) {
      setChecking(false)
      router.replace('/login')
      return
    }
    setUser(getStoredUser())
    setChecking(false)
  }, [isNoShellPath, pathname, router])

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      /* セッションは端末側で必ず破棄する */
    }
    clearAuth()
    router.push('/login')
  }

  const roleLabel = user?.role === 'admin' ? '管理者' : '一般'

  if (isNoShellPath) return <>{children}</>

  if (checking) {
    return (
      <div className="empty" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        読み込んでいます
      </div>
    )
  }

  return (
    <div className="app">
      <nav className="rail" aria-label="メインメニュー">
        <div className="rail__mark">
          <strong>食数発注</strong>
        </div>

        <div className="rail__nav">
          {navGroups.map(({ group, items }) => (
            <div key={group} style={{ marginBottom: '0.6rem' }}>
              <p
                style={{
                  margin: '0.5rem 0 0.15rem',
                  padding: '0 1.1rem',
                  fontSize: 'var(--fs-xs)',
                  color: 'rgba(242,245,243,0.42)',
                  letterSpacing: '0.1em',
                }}
              >
                {group}
              </p>
              {items.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="rail__link"
                  aria-current={pathname === href ? 'page' : undefined}
                >
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="rail__foot">
          <div className="rail__who">
            {user?.name ?? '—'}
            {user?.name !== roleLabel && <span>{roleLabel}</span>}
          </div>
          <button type="button" className="rail__out" onClick={handleLogout}>
            ログアウト
          </button>
        </div>
      </nav>

      <div className="shell">
        <header className="topbar">
          <h1>{allItems.find((n) => n.href === pathname)?.label ?? '食数発注システム'}</h1>
          <p className="topbar__date">{today}</p>
        </header>

        <main className="page">{children}</main>

        <footer className="appfoot">食数発注システム</footer>
      </div>
    </div>
  )
}
