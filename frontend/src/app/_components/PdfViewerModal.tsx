'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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
  // 表示領域の幅。900px で頭打ちにすると横長の献立表が読めない大きさになる
  const [fitWidth, setFitWidth] = useState(1000)
  const [zoom, setZoom] = useState(1)
  const viewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fit = () => {
      const available = viewRef.current?.clientWidth ?? window.innerWidth
      setFitWidth(Math.max(320, available - 32))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  const pageWidth = Math.round(fitWidth * zoom)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setPageNumber(1)
    setLoadError(null)
  }, [])

  const onLoadError = useCallback(() => {
    setLoadError('このPDFを表示できませんでした。ダウンロードして開いてください。')
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(20,32,28,0.8)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        className="on-ink"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          flexWrap: 'wrap',
          padding: '0.5rem 0.9rem',
          background: 'var(--ink)',
          color: 'var(--on-ink)',
          flexShrink: 0,
        }}
      >
        <h2 style={{ flex: 1, fontSize: 'var(--fs-base)', minWidth: 160 }}>{title}</h2>

        {numPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setPageNumber((p) => Math.max(p - 1, 1))}
              disabled={pageNumber <= 1}
            >
              前のページ
            </button>
            <span className="num" style={{ fontSize: 'var(--fs-sm)', whiteSpace: 'nowrap' }}>
              {pageNumber} / {numPages}
            </span>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setPageNumber((p) => Math.min(p + 1, numPages))}
              disabled={pageNumber >= numPages}
            >
              次のページ
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
            disabled={zoom <= 0.5}
            aria-label="縮小"
          >
            小さく
          </button>
          <span className="num" style={{ fontSize: 'var(--fs-sm)', minWidth: '3.5em', textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => setZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100))}
            disabled={zoom >= 4}
            aria-label="拡大"
          >
            大きく
          </button>
          <button type="button" className="btn btn--sm" onClick={() => setZoom(1)} disabled={zoom === 1}>
            幅に合わせる
          </button>
        </div>

        <a href={url} download={fileName} className="btn">
          ダウンロード
        </a>
        <button type="button" className="btn" onClick={handlePrint}>
          印刷
        </button>
        <button type="button" className="btn" onClick={onClose}>
          閉じる
        </button>
      </div>

      <div
        ref={viewRef}
        style={{
          flex: 1,
          overflow: 'auto',
          background: '#3b4340',
          display: 'flex',
          // 拡大して表示領域より広くなったら、中央寄せをやめて左端から見せる
          justifyContent: zoom > 1 ? 'flex-start' : 'center',
          alignItems: 'flex-start',
          padding: '1rem',
        }}
      >
        {loadError ? (
          <p style={{ color: 'var(--on-ink)', marginTop: '2rem' }}>{loadError}</p>
        ) : (
          <Document
            file={url}
            onLoadSuccess={onLoadSuccess}
            onLoadError={onLoadError}
            loading={<p style={{ color: 'var(--on-ink)', marginTop: '2rem' }}>読み込んでいます</p>}
          >
            <Page
              pageNumber={pageNumber}
              renderTextLayer
              renderAnnotationLayer
              width={pageWidth}
            />
          </Document>
        )}
      </div>
    </div>
  )
}
