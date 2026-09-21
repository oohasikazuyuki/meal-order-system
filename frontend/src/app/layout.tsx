import type { Metadata } from 'next'
import { BIZ_UDPGothic, BIZ_UDGothic } from 'next/font/google'
import AppShell from './_components/AppShell'
import './globals.css'

// 本文・ラベル：公的文書や介護記録で使われるUD書体。小さい文字でも読み違えにくい。
const ud = BIZ_UDPGothic({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ud',
})

// 数値・表の列：等幅版で桁を揃える。
const udFixed = BIZ_UDGothic({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ud-fixed',
})

export const metadata: Metadata = {
  title: '食数発注システム',
  description: '日別・週別の食数入力・発注管理システム',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${ud.variable} ${udFixed.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
