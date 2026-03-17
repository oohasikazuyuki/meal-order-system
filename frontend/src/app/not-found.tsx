import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: 640, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '2rem', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
        <p style={{ margin: 0, color: '#64748b', fontWeight: 700, fontSize: '0.9rem' }}>HTTP 404</p>
        <h1 style={{ margin: '0.5rem 0 0', color: '#1e293b', fontSize: '1.6rem' }}>ページが見つかりません</h1>
        <p style={{ margin: '0.75rem 0 0', color: '#475569', lineHeight: 1.6 }}>
          URLが変更されたか、削除された可能性があります。メニューから遷移し直してください。
        </p>
        <div style={{ marginTop: '1.25rem' }}>
          <Link href="/" style={{ textDecoration: 'none', padding: '0.6rem 1rem', background: '#1d4ed8', color: '#fff', borderRadius: 8, fontWeight: 600, display: 'inline-block' }}>
            ホームへ戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
