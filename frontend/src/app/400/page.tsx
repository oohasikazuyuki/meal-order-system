import Link from 'next/link'

export default function BadRequestPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: 640, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '2rem', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
        <p style={{ margin: 0, color: '#2563eb', fontWeight: 700, fontSize: '0.9rem' }}>HTTP 400</p>
        <h1 style={{ margin: '0.5rem 0 0', color: '#1e293b', fontSize: '1.6rem' }}>リクエストが不正です</h1>
        <p style={{ margin: '0.75rem 0 0', color: '#475569', lineHeight: 1.6 }}>
          入力内容が不足しているか、送信形式に誤りがあります。入力値を確認して、もう一度お試しください。
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <Link href="/" style={{ textDecoration: 'none', padding: '0.6rem 1rem', background: '#1d4ed8', color: '#fff', borderRadius: 8, fontWeight: 600 }}>
            ホームへ戻る
          </Link>
          <Link href="/master" style={{ textDecoration: 'none', padding: '0.6rem 1rem', background: '#e2e8f0', color: '#0f172a', borderRadius: 8, fontWeight: 600 }}>
            マスタ管理へ
          </Link>
        </div>
      </div>
    </div>
  )
}
