'use client'

import type { Supplier } from '../_lib/api/client'

/**
 * AIに材料を作らせるとき、どの仕入先から選ばせるかを指定する。
 *
 * 何をどこで頼むかは店によって違う。AIに推測させると、その施設では
 * 頼めない組み合わせが混ざる。ここで選んだ中からだけ選ばせる。
 */
export default function AiSupplierPicker({
  suppliers,
  selectedIds,
  onToggle,
  disabled,
}: {
  suppliers: Supplier[]
  selectedIds: number[]
  onToggle: (id: number) => void
  disabled?: boolean
}) {
  return (
    <fieldset className="ai-suppliers" disabled={disabled}>
      <legend>AIに使わせる仕入先</legend>
      <p className="ai-suppliers__hint">
        何をどこで頼むかは店によって違います。ここで選んだ仕入先の中からだけ材料を振り分けます。
      </p>
      <div className="ai-suppliers__list">
        {suppliers.map((s) => (
          <label key={s.id} className="ai-suppliers__item">
            <input
              type="checkbox"
              checked={selectedIds.includes(s.id)}
              onChange={() => onToggle(s.id)}
            />
            <span>{s.name}</span>
            {s.code && <span className="ai-suppliers__code">{s.code}</span>}
          </label>
        ))}
      </div>
      {selectedIds.length === 0 && (
        <p className="ai-suppliers__warn" role="alert">
          ひとつも選ばれていません。材料の仕入先が決まらないため、発注書に出ません。
        </p>
      )}
    </fieldset>
  )
}
