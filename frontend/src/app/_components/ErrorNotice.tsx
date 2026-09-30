'use client'

interface Props {
  /** 何が起きたか。使う人の言葉で書く */
  message: string
  /**
   * もう一度試す操作。読み込みの失敗なら読み込み関数を渡す。
   * 渡さなければボタンは出ない（保存の失敗など、
   * そのまま押し直せるものに二重の導線を作らないため）
   */
  onRetry?: () => void
  retryLabel?: string
  busy?: boolean
}

/**
 * 読み込みに失敗したときの表示。
 *
 * これまでは文章だけを出していた。「もう一度お試しください」と書いてあるのに
 * そのための操作が画面になく、使う人はブラウザの更新を押すしかなかった。
 * 更新すると見ていた週や絞り込みまで失われる。
 */
export default function ErrorNotice({ message, onRetry, retryLabel = 'もう一度読み込む', busy }: Props) {
  return (
    <div className="notice notice--error notice--action" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          className="btn btn--sm"
          onClick={onRetry}
          disabled={busy}
          style={{ marginLeft: 'auto' }}
        >
          {busy ? '読み込んでいます' : retryLabel}
        </button>
      )}
    </div>
  )
}
