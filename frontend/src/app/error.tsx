'use client'

import { useEffect } from 'react'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="sheet" style={{ maxWidth: 560 }}>
      <div className="sheet__head">
        <h2>この画面を表示できませんでした</h2>
      </div>
      <div className="sheet__body">
        <p style={{ margin: '0 0 0.9rem' }}>
          一時的な不具合の可能性があります。再読み込みしても直らない場合は、担当者に連絡してください。
        </p>
        <button type="button" onClick={reset} className="btn btn--primary">再読み込み</button>
      </div>
    </div>
  )
}
