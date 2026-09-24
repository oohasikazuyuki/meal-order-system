'use client'

import { useEffect, useRef } from 'react'

/**
 * モーダルの共通動作。
 *
 * - 開いた直後にフォーカスを中へ移す。これがないと、キーボードだけで
 *   操作したときに Tab がページ先頭の要素から始まってしまう
 * - Escape で閉じる
 * - 開いている間は裏のページをスクロールさせない
 *
 * 返した ref を、最初にフォーカスさせたいボタン（「閉じる」「やめる」など
 * 押しても何も起きない側）に付ける。
 */
export function useModal(onClose: () => void) {
  const initialFocusRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    initialFocusRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return initialFocusRef
}
