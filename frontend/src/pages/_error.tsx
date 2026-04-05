// Next.js 15 Pages Router のエラーページ（500.html 生成に必要）
// App Router と共存するための最小実装
function Error({ statusCode }: { statusCode?: number }) {
  return (
    <p>
      {statusCode
        ? `エラー ${statusCode} が発生しました`
        : 'クライアントでエラーが発生しました'}
    </p>
  )
}

Error.getInitialProps = ({ res, err }: { res?: { statusCode: number }; err?: { statusCode: number } }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default Error
