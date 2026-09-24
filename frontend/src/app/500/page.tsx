import Link from 'next/link'

export default function InternalServerErrorPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
      <div className="sheet" style={{ maxWidth: 560, marginBottom: 0 }}>
        <div className="sheet__head">
          <h1>サーバー側で処理が止まりました</h1>
        </div>
        <div className="sheet__body">
          <p style={{ margin: '0 0 0.9rem' }}>
            少し時間をおいて開き直してください。同じ画面で繰り返す場合は、担当者に連絡してください。
          </p>
          <div className="btnrow">
            <Link href="/" className="btn btn--primary">今日の状況へ</Link>
            <Link href="/order-sheets" className="btn">発注書へ</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
