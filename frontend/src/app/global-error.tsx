'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error(error)

  return (
    <html lang="ja">
      <body style={{ margin: 0, fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif', background: '#f8fafc' }}>
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
          <div style={{ width: '100%', maxWidth: 640, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '2rem', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
            <p style={{ margin: 0, color: '#b91c1c', fontWeight: 700, fontSize: '0.9rem' }}>Critical Error</p>
            <h1 style={{ margin: '0.5rem 0 0', color: '#1e293b', fontSize: '1.6rem' }}>致命的なエラーが発生しました</h1>
            <p style={{ margin: '0.75rem 0 0', color: '#475569', lineHeight: 1.6 }}>
              システム全体で予期しないエラーが発生しました。時間をおいて再度アクセスしてください。
            </p>
            <div style={{ marginTop: '1.25rem' }}>
              <button onClick={reset} style={{ padding: '0.6rem 1rem', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                再読み込み
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
