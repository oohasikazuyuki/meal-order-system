import Link from 'next/link'

export default function BadRequestPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
      <div className="sheet" style={{ maxWidth: 560, marginBottom: 0 }}>
        <div className="sheet__head">
          <h1>入力内容を送信できませんでした</h1>
        </div>
        <div className="sheet__body">
          <p style={{ margin: '0 0 0.9rem' }}>
            必須の項目が足りないか、形式が合っていません。前の画面に戻って入力値を確認してください。
          </p>
          <div className="btnrow">
            <Link href="/" className="btn btn--primary">今日の状況へ</Link>
            <Link href="/master" className="btn">マスタ管理へ</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
