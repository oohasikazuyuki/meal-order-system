'use client'

import { useEffect, useRef } from 'react'

interface Props {
  title: string
  /** 何が起きるかを具体的に書く。「よろしいですか」だけにしない */
  message: string
  /** 実行ボタンの文言。何が起きるかをそのまま書く（「削除する」「破棄する」） */
  confirmLabel: string
  cancelLabel?: string
  /** 取り消せない操作は true。実行ボタンを警告色にする */
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * アプリ内の確認ダイアログ。
 *
 * ブラウザの confirm() はページ全体を止め、見た目も文言の書き方も制御できない。
 * 画面の一部として出すことで、何が起きるかを具体的に書けるようにする。
 *
 * 開いたら取り消しボタンに初期フォーカスを当てる（誤って実行しないため）。
 * Escape と背景クリックで閉じる。Tab はダイアログ内で循環する。
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'やめる',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // 破壊的な操作ほど、初期フォーカスは安全な側に置く
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
        return
      }
      if (e.key !== 'Tab') return

      // ダイアログの外にフォーカスが出ないようにする
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        ref={dialogRef}
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        style={{ maxWidth: 420 }}
      >
        <div className="modal__head">
          <h2 id="confirm-title">{title}</h2>
        </div>

        <div className="modal__body">
          <p id="confirm-message" style={{ margin: 0, lineHeight: 1.7 }}>
            {message}
          </p>
        </div>

        <div className="modal__foot">
          <button type="button" className="btn" ref={cancelRef} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={destructive ? 'btn btn--danger' : 'btn btn--primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
