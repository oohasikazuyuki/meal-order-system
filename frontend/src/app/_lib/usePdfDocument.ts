'use client'

import { useCallback, useState } from 'react'

/** 画面に出しているPDF。閉じるときに URL を解放する必要がある */
interface OpenDocument {
  url: string
  /** モーダルの見出し */
  title: string
  /** 保存したときのファイル名 */
  fileName: string
}

/**
 * PDFを取ってきて画面に出すまでの共通処理。
 *
 * 献立表と発注書で、取得 → Blob化 → objectURL作成 → モーダルに渡す →
 * 閉じるときに解放、という同じ流れがそれぞれ書かれていた。
 * objectURL の解放漏れは見た目に出ないので、書き写すたびに抜ける。
 *
 * key は「どのボタンを押したか」を表す。並んだボタンのうち
 * 押されたものだけを処理中にするために使う。
 */
export function usePdfDocument() {
  const [doc, setDoc] = useState<OpenDocument | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const open = useCallback(
    async (
      key: string,
      fetchPdf: () => Promise<{ data: BlobPart }>,
      meta: { title: string; fileName: string },
      errorMessage: string
    ) => {
      setPendingKey(key)
      setError(null)
      try {
        const res = await fetchPdf()
        const blob = new Blob([res.data], { type: 'application/pdf' })
        setDoc({ url: URL.createObjectURL(blob), ...meta })
      } catch {
        setError(errorMessage)
      } finally {
        setPendingKey(null)
      }
    },
    []
  )

  const close = useCallback(() => {
    setDoc((current) => {
      if (current) {
        // 閉じるアニメーションの途中で解放すると表示が消えるので少し待つ
        setTimeout(() => URL.revokeObjectURL(current.url), 1000)
      }
      return null
    })
  }, [])

  return { doc, pendingKey, error, setError, open, close }
}
