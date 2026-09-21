import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="sheet" style={{ maxWidth: 560 }}>
      <div className="sheet__head">
        <h2>ページが見つかりません</h2>
      </div>
      <div className="sheet__body">
        <p style={{ margin: '0 0 0.9rem' }}>
          このURLのページはありません。左のメニューから開き直してください。
        </p>
        <Link href="/" className="btn btn--primary">今日の状況へ</Link>
      </div>
    </div>
  )
}
