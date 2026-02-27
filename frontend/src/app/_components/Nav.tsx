'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: '発注入力' },
  { href: '/orders', label: '発注一覧' },
  { href: '/summary', label: '日別集計' },
  { href: '/daily-order', label: '食数発注' },
  { href: '/menus', label: 'メニュー管理' },
  { href: '/master', label: 'マスタ管理' },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <nav style={{ padding: '1rem 2rem', background: '#333', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          style={{
            color: pathname === href ? '#4fc3f7' : '#fff',
            textDecoration: 'none',
            fontWeight: pathname === href ? 'bold' : 'normal',
          }}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
