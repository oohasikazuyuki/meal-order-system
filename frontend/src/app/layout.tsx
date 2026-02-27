import type { Metadata } from 'next'
import AppShell from './_components/AppShell'

export const metadata: Metadata = {
  title: '食数発注システム',
  description: '日別・週別の食数入力・発注管理システム',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{
        margin: 0,
        fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif',
        background: '#f0f4f8',
        color: '#1a202c',
        minHeight: '100vh',
      }}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
