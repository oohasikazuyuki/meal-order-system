'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: 640, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '2rem', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
        <p style={{ margin: 0, color: '#b91c1c', fontWeight: 700, fontSize: '0.9rem' }}>Application Error</p>
        <h1 style={{ margin: '0.5rem 0 0', color: '#1e293b', fontSize: '1.6rem' }}>画面の読み込みに失敗しました</h1>
        <p style={{ margin: '0.75rem 0 0', color: '#475569', lineHeight: 1.6 }}>
          一時的なエラーの可能性があります。再試行しても改善しない場合はホームに戻ってください。
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <button onClick={reset} style={{ padding: '0.6rem 1rem', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
            再試行
          </button>
          <button onClick={() => router.push('/500')} style={{ padding: '0.6rem 1rem', background: '#e2e8f0', color: '#0f172a', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
            500画面を開く
          </button>
        </div>
      </div>
    </div>
  )
}
