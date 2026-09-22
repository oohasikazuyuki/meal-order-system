'use client'

import { useState } from 'react'
import { useModal } from '../_lib/useModal'
import {
  toOrderCodeText,
  toReadableText,
  linesWithoutCode,
  type CoopOrderLine,
} from '../_lib/coopOrderList'

interface Props {
  lines: CoopOrderLine[]
  weekStart: string
  weekEnd: string
  onClose: () => void
}

/**
 * 生協に出す発注リスト。
 *
 * eふれんずには「注文コードでご注文」があり、注文コードと数量を並べて
 * 入力すればまとめて注文できる。ここではそこに貼れる形をそのまま出す。
 *
 * 生協側に外部から発注するための窓口（APIや一括取込）が無いため、
 * 最後に人がeふれんずへ貼る工程は残る。ここで減らせるのは
 * 「カタログを引き直して番号を探す」手間のほう。
 */
export default function CoopOrderListModal({ lines, weekStart, weekEnd, onClose }: Props) {
  const closeRef = useModal(onClose)
  const [copied, setCopied] = useState<'code' | 'readable' | null>(null)

  const codeText = toOrderCodeText(lines)
  const readable = toReadableText(lines, weekStart, weekEnd)
  const missing = linesWithoutCode(lines)

  const copy = async (text: string, which: 'code' | 'readable') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      // クリップボードが使えない環境では、下のテキスト欄から手で選んでもらう
      setCopied(null)
    }
  }

  return (
    <div className="backdrop" role="dialog" aria-modal="true" aria-labelledby="coop-list-title">
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal__head">
          <h2 id="coop-list-title">生協への発注リスト</h2>
          <button
            type="button"
            className="btn btn--sm"
            ref={closeRef}
            onClick={onClose}
            style={{ marginLeft: 'auto' }}
          >
            閉じる
          </button>
        </div>

        <div className="modal__body">
          {lines.length === 0 ? (
            <p className="empty">発注する数量が入っていません。</p>
          ) : (
            <>
              <table className="data">
                <thead>
                  <tr>
                    <th>注文コード</th>
                    <th>品目</th>
                    <th className="num">数量</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.itemId}>
                      <td className="num">
                        {l.orderCode ?? <span className="tag tag--warn">未登録</span>}
                      </td>
                      <td>{l.name}</td>
                      <td className="num">
                        {l.quantity} {l.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {missing.length > 0 && (
                <p className="notice notice--error" role="alert">
                  {missing.map((l) => l.name).join('、')}
                  は注文コードが未登録です。コードを入れるまで、この{missing.length}品は
                  eふれんずで品物を探して注文してください。
                </p>
              )}

              <h3 style={{ marginTop: '1rem', fontSize: 'var(--fs-base)' }}>
                eふれんずの「注文コードでご注文」に貼る
              </h3>
              <p className="muted" style={{ margin: '0.2rem 0 0.4rem', fontSize: 'var(--fs-sm)' }}>
                左がコード、右が数量です。貼ったあとに「商品名・金額を表示」で中身を必ず確かめてください。
              </p>
              <textarea
                className="input"
                readOnly
                rows={Math.min(10, Math.max(3, lines.length))}
                value={codeText}
                onFocus={(e) => e.currentTarget.select()}
                style={{ fontFamily: 'var(--font-ud-fixed), monospace', width: '100%' }}
                aria-label="注文コードと数量"
              />

              <h3 style={{ marginTop: '1rem', fontSize: 'var(--fs-base)' }}>控え</h3>
              <textarea
                className="input"
                readOnly
                rows={Math.min(10, Math.max(3, lines.length + 1))}
                value={readable}
                onFocus={(e) => e.currentTarget.select()}
                style={{ width: '100%' }}
                aria-label="発注内容の控え"
              />
            </>
          )}
        </div>

        {lines.length > 0 && (
          <div className="modal__foot">
            <span role="status" aria-live="polite" style={{ marginRight: 'auto', color: 'var(--ok)' }}>
              {copied === 'code' ? 'コードと数量をコピーしました' : copied === 'readable' ? '控えをコピーしました' : ''}
            </span>
            <button type="button" className="btn" onClick={() => copy(readable, 'readable')}>
              控えをコピー
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => copy(codeText, 'code')}
              disabled={codeText === ''}
            >
              コードと数量をコピー
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
