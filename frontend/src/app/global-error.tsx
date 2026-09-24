'use client'

import './globals.css'

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
      <body>
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
          <div className="sheet" style={{ maxWidth: 560, marginBottom: 0 }}>
            <div className="sheet__head">
              <h1>システムを読み込めませんでした</h1>
            </div>
            <div className="sheet__body">
              <p style={{ margin: '0 0 0.9rem' }}>
                予期しないエラーが発生しました。再読み込みしても直らない場合は、担当者に連絡してください。
              </p>
              <button type="button" onClick={reset} className="btn btn--primary">再読み込み</button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
