'use client'

import { useState, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

interface PdfViewerModalProps {
  url: string
  fileName: string
  title: string
  onClose: () => void
}

export default function PdfViewerModal({ url, fileName, title, onClose }: PdfViewerModalProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [loadError, setLoadError] = useState<string | null>(null)

  const onLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setPageNumber(1)
    setLoadError(null)
  }, [])

  const onLoadError = useCallback(() => {
    setLoadError('PDFの読み込みに失敗しました')
  }, [])

  const handlePrint = () => {
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.src = url
    document.body.appendChild(iframe)
    iframe.onload = () => {
      iframe.contentWindow?.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ヘッダー */}
      <div style={{
        background: '#1a3a5c', padding: '0.75rem 1.25rem',
        display: 'flex', alignItems: 'center', gap: '1rem',
        flexShrink: 0,
      }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', flex: 1 }}>
          📄 {title}
        </span>

        {/* ページネーション */}
        {numPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setPageNumber(p => Math.max(p - 1, 1))}
              disabled={pageNumber <= 1}
              style={headerBtn(pageNumber <= 1)}
            >
              ← 前
            </button>
            <span style={{ color: '#fff', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
              {pageNumber} / {numPages}
            </span>
            <button
              onClick={() => setPageNumber(p => Math.min(p + 1, numPages))}
              disabled={pageNumber >= numPages}
              style={headerBtn(pageNumber >= numPages)}
            >
              次 →
            </button>
          </div>
        )}

        {/* ダウンロード */}
        <a
          href={url}
          download={fileName}
          style={{
            padding: '0.45rem 1rem', background: '#059669', color: '#fff',
            borderRadius: 8, fontSize: '0.85rem', fontWeight: 600,
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}
        >
          💾 ダウンロード
        </a>

        {/* 印刷 */}
        <button
          onClick={handlePrint}
          style={{
            padding: '0.45rem 1rem', background: 'rgba(255,255,255,0.15)', color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8,
            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          🖨 印刷
        </button>

        {/* 閉じる */}
        <button
          onClick={onClose}
          style={{
            padding: '0.45rem 1rem', background: '#dc2626', color: '#fff',
            border: 'none', borderRadius: 8,
            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          ✕ 閉じる
        </button>
      </div>

      {/* PDF 表示エリア */}
      <div style={{
        flex: 1, overflowY: 'auto', background: '#525659',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        padding: '1.5rem',
      }}>
        {loadError ? (
          <div style={{ color: '#fff', marginTop: '2rem' }}>⚠ {loadError}</div>
        ) : (
          <Document
            file={url}
            onLoadSuccess={onLoadSuccess}
            onLoadError={onLoadError}
            loading={
              <div style={{ color: '#ccc', marginTop: '2rem', fontSize: '1rem' }}>⏳ 読み込み中...</div>
            }
          >
            <Page
              pageNumber={pageNumber}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              width={Math.min(typeof window !== 'undefined' ? window.innerWidth - 64 : 900, 900)}
            />
          </Document>
        )}
      </div>

      {/* フッター（ページネーション補助） */}
      {numPages > 1 && (
        <div style={{
          background: '#1a3a5c', padding: '0.5rem',
          display: 'flex', justifyContent: 'center', gap: '0.5rem',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setPageNumber(1)}
            disabled={pageNumber <= 1}
            style={footerBtn(pageNumber <= 1)}
          >
            ⟪ 最初
          </button>
          <button
            onClick={() => setPageNumber(p => Math.max(p - 1, 1))}
            disabled={pageNumber <= 1}
            style={footerBtn(pageNumber <= 1)}
          >
            ← 前
          </button>
          <span style={{ color: '#fff', fontSize: '0.85rem', padding: '0.3rem 0.75rem', lineHeight: '1.8' }}>
            {pageNumber} / {numPages} ページ
          </span>
          <button
            onClick={() => setPageNumber(p => Math.min(p + 1, numPages))}
            disabled={pageNumber >= numPages}
            style={footerBtn(pageNumber >= numPages)}
          >
            次 →
          </button>
          <button
            onClick={() => setPageNumber(numPages)}
            disabled={pageNumber >= numPages}
            style={footerBtn(pageNumber >= numPages)}
          >
            最後 ⟫
          </button>
        </div>
      )}
    </div>
  )
}

function headerBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.35rem 0.75rem',
    background: disabled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)',
    color: disabled ? 'rgba(255,255,255,0.35)' : '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 6, fontSize: '0.8rem', fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

function footerBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.3rem 0.75rem',
    background: disabled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)',
    color: disabled ? 'rgba(255,255,255,0.35)' : '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 6, fontSize: '0.8rem', cursor: disabled ? 'not-allowed' : 'pointer',
  }
}
