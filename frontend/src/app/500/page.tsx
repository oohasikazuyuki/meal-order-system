import Link from 'next/link'

export default function InternalServerErrorPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: 640, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '2rem', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
        <p style={{ margin: 0, color: '#b91c1c', fontWeight: 700, fontSize: '0.9rem' }}>HTTP 500</p>
        <h1 style={{ margin: '0.5rem 0 0', color: '#1e293b', fontSize: '1.6rem' }}>サーバーエラーが発生しました</h1>
        <p style={{ margin: '0.75rem 0 0', color: '#475569', lineHeight: 1.6 }}>
          内部処理でエラーが発生しました。時間をおいて再試行してください。改善しない場合は管理者へ連絡してください。
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <Link href="/" style={{ textDecoration: 'none', padding: '0.6rem 1rem', background: '#1d4ed8', color: '#fff', borderRadius: 8, fontWeight: 600 }}>
            ホームへ戻る
          </Link>
          <Link href="/order-sheets" style={{ textDecoration: 'none', padding: '0.6rem 1rem', background: '#e2e8f0', color: '#0f172a', borderRadius: 8, fontWeight: 600 }}>
            発注書画面へ
          </Link>
        </div>
      </div>
    </div>
  )
}
