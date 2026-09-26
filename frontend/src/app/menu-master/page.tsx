'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import ConfirmDialog from '../_components/ConfirmDialog'
import { useModal } from '../_lib/useModal'
import { useStringParam } from '../_lib/useUrlState'
import {
  fetchMenuMasters,
  createMenuMaster,
  updateMenuMaster,
  deleteMenuMaster,
  fetchBlocks,
  fetchSuppliers,
  draftMenuMasterByAi,
  bulkDraftMenuMasterByAi,
  type MenuMaster,
  type MenuMasterInput,
  type MenuIngredientInput,
  type Block,
  type Supplier,
  type AiMenuMasterDraftResponse,
  type AiMenuMasterBulkDish,
} from '../_lib/api/client'

const UNIT_OPTIONS = ['g', 'kg', 'ml', 'L', '個', '枚', '本', '袋', '缶', '束', '合', '大さじ', '小さじ', '切れ', '適量']
const DISH_CATEGORY_PRESETS = ['主食', '副菜', '主菜', '汁物', '丼物', 'デザート', 'おやつ']
const FRACTION_OPTIONS: Array<{ label: string; value: number }> = [
  { label: '1/8', value: 0.125 },
  { label: '1/6', value: 1 / 6 },
  { label: '1/5', value: 0.2 },
  { label: '1/4', value: 0.25 },
  { label: '1/3', value: 1 / 3 },
  { label: '1/2', value: 0.5 },
  { label: '2/3', value: 2 / 3 },
  { label: '3/4', value: 0.75 },
  { label: '1', value: 1 },
  { label: '1 1/2', value: 1.5 },
  { label: '2', value: 2 },
]
const FRACTION_UNITS = new Set(['個', '枚', '本', '袋', '缶', '束', '切れ'])
const AI_PUBLIC_ENABLED = process.env.NEXT_PUBLIC_AI_PUBLIC_ENABLED === 'true'

const parseAmountInput = (value: string): number => {
  const v = value.trim()
  if (!v) return 0
  const mixed = v.match(/^([0-9]+)\s+([0-9]+)\s*\/\s*([0-9]+(?:\.[0-9]+)?)$/)
  if (mixed) {
    const whole = Number(mixed[1])
    const num = Number(mixed[2])
    const den = Number(mixed[3])
    return den > 0 ? whole + num / den : 0
  }
  const m = v.match(/^([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+(?:\.[0-9]+)?)$/)
  if (m) {
    const num = Number(m[1])
    const den = Number(m[2])
    return den > 0 ? num / den : 0
  }
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const amountToFractionLabel = (amount: number): string | null =>
  FRACTION_OPTIONS.find((o) => Math.abs(o.value - amount) < 0.001)?.label ?? null

const formatAmountLabel = (amount: number): string => amountToFractionLabel(amount) ?? String(amount)

export default function MenuMasterPage() {
  const [masters, setMasters] = useState<MenuMaster[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<MenuMaster | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useStringParam('q')
  // ブロックは 'all' / '共通'(=null) / ブロックID の3通り。URLには文字列で置く
  const [blockParam, setBlockParam] = useStringParam('block', 'all')
  const [filterCategory, setFilterCategory] = useStringParam('category', 'all')
  const filterBlockId: number | null | 'all' =
    blockParam === 'all' ? 'all' : blockParam === 'common' ? null : Number(blockParam)
  const setFilterBlockId = (next: number | null | 'all') =>
    setBlockParam(next === 'all' ? 'all' : next === null ? 'common' : String(next))
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MenuMaster | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mastersRes, blocksRes, suppliersRes] = await Promise.all([
        fetchMenuMasters(),
        fetchBlocks(),
        fetchSuppliers(),
      ])
      setMasters(mastersRes.data.menu_masters)
      setBlocks(blocksRes.data.blocks)
      setSuppliers(suppliersRes.data.suppliers)
    } catch {
      setError('メニューを読み込めませんでした。通信を確認して再読み込みしてください。')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async (m: MenuMaster) => {
    setDeleteTarget(null)
    const prevMasters = masters
    setMasters((prev) => prev.filter((x) => x.id !== m.id))
    try {
      await deleteMenuMaster(m.id)
      setSuccessMsg(`「${m.name}」を削除しました`)
    } catch {
      setMasters(prevMasters)
      setError('削除できませんでした。もう一度お試しください。')
    }
  }

  const handleSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setShowForm(false)
    setEditTarget(null)
    load()
  }

  const filtered = masters.filter((m) => {
    if (!m.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (filterBlockId !== 'all') {
      if (filterBlockId === null && m.block_id !== null) return false
      if (filterBlockId !== null && m.block_id !== filterBlockId) return false
    }
    if (filterCategory !== 'all') {
      if (filterCategory === '__none') return !m.dish_category
      if (m.dish_category !== filterCategory) return false
    }
    return true
  })

  const existingCategories = Array.from(
    new Set(masters.map((m) => m.dish_category).filter(Boolean))
  ) as string[]
  const allCategories = Array.from(new Set([...DISH_CATEGORY_PRESETS, ...existingCategories]))

  const blockName = (id: number | null) =>
    id === null ? null : (blocks.find((b) => b.id === id)?.name ?? `ブロック${id}`)

  const openForm = (target: MenuMaster | null) => {
    setEditTarget(target)
    setShowForm(true)
    setError(null)
    setSuccessMsg(null)
  }

  return (
    <div>
      {deleteTarget && (
        <ConfirmDialog
          title="メニューを削除します"
          message={`「${deleteTarget.name}」と、登録されている材料${(deleteTarget.menu_ingredients ?? []).length}品目を削除します。すでに献立に使われている分はそのまま残ります。`}
          confirmLabel="削除する"
          destructive
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
      {successMsg && <p className="notice notice--ok">{successMsg}</p>}

      {showBulkModal && (
        <BulkAiModal
          blocks={blocks}
          onClose={() => setShowBulkModal(false)}
          onSuccess={(count) => {
            setSuccessMsg(`${count}件のメニューを登録しました`)
            setShowBulkModal(false)
            load()
          }}
        />
      )}

      {showForm && (
        <MenuMasterForm
          initial={editTarget}
          blocks={blocks}
          suppliers={suppliers}
          onSuccess={handleSuccess}
          onCancel={() => {
            setShowForm(false)
            setEditTarget(null)
          }}
        />
      )}

      <section className="sheet">
        <div className="sheet__head">
          <h2>メニューと材料</h2>
          <div className="sheet__meta">
            <span>
              <span className="num">{filtered.length}</span> / {masters.length} 件
            </span>
            {AI_PUBLIC_ENABLED && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setShowBulkModal(true)
                  setError(null)
                  setSuccessMsg(null)
                }}
              >
                AIでまとめて作る
              </button>
            )}
            <button type="button" className="btn" onClick={() => openForm(null)}>
              メニューを追加
            </button>
          </div>
        </div>

        <div className="sheet__body" style={{ borderBottom: '1px solid var(--rule-soft)' }}>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="field" style={{ marginBottom: 0, flex: 1, minWidth: 180, maxWidth: 320 }}>
              <span>メニュー名で探す</span>
              <input
                className="input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
            <label className="field" style={{ marginBottom: 0, minWidth: 140 }}>
              <span>料理区分</span>
              <select
                className="select"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">すべて</option>
                <option value="__none">未分類</option>
                {allCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="field" style={{ marginBottom: 0, minWidth: 160 }}>
              <span>対象ブロック</span>
              <select
                className="select"
                value={
                  filterBlockId === null ? '__common' : filterBlockId === 'all' ? 'all' : String(filterBlockId)
                }
                onChange={(e) => {
                  const v = e.target.value
                  if (v === 'all') setFilterBlockId('all')
                  else if (v === '__common') setFilterBlockId(null)
                  else setFilterBlockId(Number(v))
                }}
              >
                <option value="all">すべて</option>
                <option value="__common">共通（ブロック指定なし）</option>
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <p className="empty">読み込んでいます</p>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <p>
              {searchQuery || filterCategory !== 'all' || filterBlockId !== 'all'
                ? '条件に合うメニューはありません。絞り込みを変えてみてください。'
                : 'メニューがまだ登録されていません。'}
            </p>
            <button type="button" className="btn" onClick={() => openForm(null)}>
              メニューを追加する
            </button>
          </div>
        ) : (
          <div className="sheet__scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>メニュー名</th>
                  <th>料理区分</th>
                  <th>対象</th>
                  <th className="num">1人あたり</th>
                  <th className="num">材料</th>
                  <th style={{ textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const ings = m.menu_ingredients ?? []
                  const bn = blockName(m.block_id)
                  const open = openId === m.id
                  return (
                    <Fragment key={m.id}>
                      <tr>
                        <td className="lead">
                          {m.name}
                          {m.memo && (
                            <span className="muted" style={{ fontWeight: 400 }}>
                              {' '}
                              {m.memo}
                            </span>
                          )}
                        </td>
                        <td>
                          {m.dish_category ? (
                            <span className="tag tag--plain">{m.dish_category}</span>
                          ) : (
                            <span className="muted">未分類</span>
                          )}
                        </td>
                        <td>{bn ? `${bn}専用` : <span className="muted">共通</span>}</td>
                        <td className="num">{Number(m.grams_per_person) > 0 ? `${Number(m.grams_per_person)}g` : '—'}</td>
                        <td className="num">
                          {ings.length > 0 ? (
                            <button
                              type="button"
                              className="btn btn--sm"
                              aria-expanded={open}
                              onClick={() => setOpenId(open ? null : m.id)}
                            >
                              {ings.length}品目
                            </button>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          <div className="actions">
                            <button type="button" className="btn btn--sm" onClick={() => openForm(m)}>
                              編集
                            </button>
                            <button
                              type="button"
                              className="btn btn--sm btn--danger"
                              onClick={() => setDeleteTarget(m)}
                            >
                              削除
                            </button>
                          </div>
                        </td>
                      </tr>
                      {open && ings.length > 0 && (
                        <tr>
                          <td colSpan={6} style={{ background: 'var(--paper-alt)' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                              {ings.map((ing) => (
                                <span key={ing.id} className="tag tag--plain">
                                  {ing.name}{' '}
                                  {ing.persons_per_unit
                                    ? `${ing.persons_per_unit}人で1${ing.unit}`
                                    : ing.amount > 0
                                      ? `${formatAmountLabel(ing.amount)}${ing.unit}`
                                      : ing.unit}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

// ============================================================
// 追加・編集フォーム
// ============================================================
function MenuMasterForm({
  initial,
  blocks,
  suppliers,
  onSuccess,
  onCancel,
}: {
  initial: MenuMaster | null
  blocks: Block[]
  suppliers: Supplier[]
  onSuccess: (msg: string) => void
  onCancel: () => void
}) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [dishCategory, setDishCategory] = useState(initial?.dish_category ?? '')
  const [blockId, setBlockId] = useState<number | null>(initial?.block_id ?? null)
  const [grams, setGrams] = useState(String(initial?.grams_per_person ?? ''))
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [ingredients, setIngredients] = useState<MenuIngredientInput[]>(
    initial?.menu_ingredients?.map((i) => ({
      name: i.name,
      amount: i.amount,
      unit: i.unit,
      persons_per_unit: i.persons_per_unit ?? null,
      supplier_id: i.supplier_id ?? null,
    })) ?? [{ name: '', amount: 0, unit: 'g', persons_per_unit: null, supplier_id: null }]
  )
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiElapsedSec, setAiElapsedSec] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [aiInfo, setAiInfo] = useState<string | null>(null)

  const addIngRow = () =>
    setIngredients((prev) => [
      ...prev,
      { name: '', amount: 0, unit: 'g', persons_per_unit: null, supplier_id: null },
    ])
  const removeIngRow = (idx: number) => setIngredients((prev) => prev.filter((_, i) => i !== idx))
  const updateIng = (idx: number, patch: Partial<MenuIngredientInput>) =>
    setIngredients((prev) => {
      const a = [...prev]
      a[idx] = { ...a[idx], ...patch }
      return a
    })

  useEffect(() => {
    if (!aiLoading) return
    setAiElapsedSec(0)
    const started = Date.now()
    const timer = setInterval(() => setAiElapsedSec(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [aiLoading])

  const applyAiDraft = (draft: AiMenuMasterDraftResponse['draft']) => {
    setGrams(String(draft.grams_per_person ?? 0))
    setMemo(draft.memo ?? '')
    if (Array.isArray(draft.ingredients) && draft.ingredients.length > 0) {
      setIngredients(
        draft.ingredients.map((i) => ({
          name: i.name ?? '',
          amount: Number(i.amount ?? 0),
          unit: i.unit || 'g',
          persons_per_unit: i.persons_per_unit ?? null,
          supplier_id: i.supplier_id ?? null,
        }))
      )
    }
  }

  const handleAiDraft = async () => {
    setAiLoading(true)
    setError(null)
    setAiInfo(null)
    try {
      const res = await draftMenuMasterByAi({ name: name.trim() || undefined, block_id: blockId })
      const body: AiMenuMasterDraftResponse = res.data
      if (!body.ok || !body.draft) {
        setError(body.message || 'AIの下書きを取得できませんでした。')
        return
      }
      if (body.name && body.name.trim()) setName(body.name.trim())
      applyAiDraft(body.draft)
      if (body.name_generated) setAiInfo('AIが料理名を付けました。必要なら書き換えてください。')
    } catch {
      setError('AIの下書きを取得できませんでした。AIの接続設定を確認してください。')
    } finally {
      setAiLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('メニュー名を入力してください。')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const data: MenuMasterInput = {
        name: name.trim(),
        dish_category: dishCategory.trim() || null,
        block_id: blockId,
        grams_per_person: parseFloat(grams) || 0,
        memo: memo.trim(),
        ingredients: ingredients.filter((i) => i.name.trim()),
      }
      if (isEdit && initial) {
        await updateMenuMaster(initial.id, data)
        onSuccess(`「${name}」を更新しました`)
      } else {
        await createMenuMaster(data)
        onSuccess(`「${name}」を追加しました`)
      }
    } catch {
      setError('保存できませんでした。入力内容を確認して、もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="sheet" onSubmit={handleSubmit}>
      <div className="sheet__head">
        <h2>{isEdit ? `${initial!.name} を編集` : 'メニューを追加'}</h2>
      </div>

      <div className="sheet__body">
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        {AI_PUBLIC_ENABLED && aiInfo && <p className="notice notice--ok">{aiInfo}</p>}
        {AI_PUBLIC_ENABLED && aiLoading && (
          <p className="notice">AIが下書きを作っています（{aiElapsedSec}秒）</p>
        )}

        <div className="grid2">
          <div className="field">
            <span className="field__label">メニュー名</span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                className="input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="おかゆ定食"
                autoFocus
              />
              {AI_PUBLIC_ENABLED && (
                <button
                  type="button"
                  className="btn"
                  onClick={handleAiDraft}
                  disabled={aiLoading || saving}
                >
                  {aiLoading ? '作成中' : 'AIで下書き'}
                </button>
              )}
            </div>
          </div>

          <label className="field">
            <span>対象ブロック</span>
            <select
              className="select"
              value={blockId === null ? '' : String(blockId)}
              onChange={(e) => setBlockId(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">共通（すべてのブロックで選べる）</option>
              {blocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}専用
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>1人あたりの分量（g）</span>
            <input
              className="input input--num"
              type="number"
              min={0}
              step={0.1}
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
            />
          </label>

          <label className="field">
            <span>メモ</span>
            <input
              className="input"
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </label>
        </div>

        <div className="field">
          <span className="field__label">料理区分</span>
          <div className="btnrow" style={{ marginBottom: '0.3rem' }}>
            {DISH_CATEGORY_PRESETS.map((cat) => (
              <button
                key={cat}
                type="button"
                className={dishCategory === cat ? 'btn btn--sm btn--primary' : 'btn btn--sm'}
                aria-pressed={dishCategory === cat}
                onClick={() => setDishCategory(dishCategory === cat ? '' : cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <input
            className="input"
            type="text"
            value={dishCategory}
            onChange={(e) => setDishCategory(e.target.value)}
            placeholder="ここに直接書くこともできます（麺類 など）"
          />
        </div>

        <div className="field">
          <span className="field__label">
            材料
            <span className="field__hint">なくても登録できます</span>
          </span>

          <div className="sheet__scroll">
            <table className="data" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th>材料名</th>
                  <th className="num">量</th>
                  <th>単位</th>
                  <th className="num">何人で1単位</th>
                  <th>仕入先</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {ingredients.map((ing, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        className="input"
                        type="text"
                        value={ing.name}
                        onChange={(e) => updateIng(idx, { name: e.target.value })}
                        aria-label={`材料${idx + 1}の名前`}
                      />
                    </td>
                    <td className="num">
                      {ing.persons_per_unit ? (
                        <span className="muted">—</span>
                      ) : FRACTION_UNITS.has(ing.unit) ? (
                        <select
                          className="select"
                          value={amountToFractionLabel(ing.amount) ?? ''}
                          onChange={(e) => updateIng(idx, { amount: parseAmountInput(e.target.value || '0') })}
                          aria-label={`材料${idx + 1}の量`}
                          style={{ width: 88 }}
                        >
                          <option value="">選ぶ</option>
                          {FRACTION_OPTIONS.map((o) => (
                            <option key={o.label} value={o.label}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="input input--num"
                          type="text"
                          inputMode="decimal"
                          value={ing.amount || ''}
                          onChange={(e) => updateIng(idx, { amount: parseAmountInput(e.target.value) })}
                          aria-label={`材料${idx + 1}の量`}
                          placeholder="0.5"
                          style={{ width: 88 }}
                        />
                      )}
                    </td>
                    <td>
                      <select
                        className="select"
                        value={ing.unit}
                        onChange={(e) => updateIng(idx, { unit: e.target.value })}
                        aria-label={`材料${idx + 1}の単位`}
                        style={{ width: 90 }}
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="num">
                      <input
                        className="input input--num"
                        type="number"
                        min={1}
                        step={1}
                        value={ing.persons_per_unit ?? ''}
                        onChange={(e) =>
                          updateIng(idx, {
                            persons_per_unit: e.target.value === '' ? null : parseInt(e.target.value),
                          })
                        }
                        aria-label={`材料${idx + 1}は何人で1${ing.unit || '単位'}か`}
                        style={{ width: 70 }}
                      />
                    </td>
                    <td>
                      <select
                        className="select"
                        value={ing.supplier_id ?? ''}
                        onChange={(e) =>
                          updateIng(idx, {
                            supplier_id: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        aria-label={`材料${idx + 1}の仕入先`}
                        style={{ minWidth: 110 }}
                      >
                        <option value="">選ばない</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--sm btn--danger"
                        onClick={() => removeIngRow(idx)}
                        aria-label={`材料${idx + 1}を消す`}
                      >
                        消す
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" className="btn btn--sm" onClick={addIngRow} style={{ marginTop: '0.4rem' }}>
            材料の行を足す
          </button>
        </div>

        <p className="notice" style={{ marginBottom: 0 }}>
          {blockId === null
            ? '共通メニューは、すべてのブロックの献立で選べます。'
            : `このメニューは「${blocks.find((b) => b.id === blockId)?.name}」の献立でだけ選べます。`}
        </p>
      </div>

      <div className="modal__foot">
        <button type="button" className="btn" onClick={onCancel}>
          やめる
        </button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? '保存しています' : isEdit ? '更新する' : '追加する'}
        </button>
      </div>
    </form>
  )
}

// ============================================================
// AIでまとめて作る
// ============================================================
function BulkAiModal({
  blocks,
  onClose,
  onSuccess,
}: {
  blocks: Block[]
  onClose: () => void
  onSuccess: (count: number) => void
}) {
  const [blockId, setBlockId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [dishes, setDishes] = useState<AiMenuMasterBulkDish[] | null>(null)
  const [selected, setSelected] = useState<boolean[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const closeRef = useModal(onClose)

  useEffect(() => {
    if (!loading) return
    setElapsedSec(0)
    const started = Date.now()
    const timer = setInterval(() => setElapsedSec(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [loading])

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setDishes(null)
    setSelected([])
    try {
      const res = await bulkDraftMenuMasterByAi({ block_id: blockId })
      const body = res.data
      if (!body.ok || !body.dishes?.length) {
        setError(body.message || 'メニューを作れませんでした。もう一度お試しください。')
        return
      }
      setDishes(body.dishes)
      setSelected(body.dishes.map(() => true))
    } catch {
      setError('メニューを作れませんでした。AIの接続設定を確認してください。')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!dishes) return
    setSaving(true)
    setError(null)
    let saved = 0
    try {
      for (let i = 0; i < dishes.length; i++) {
        if (!selected[i]) continue
        const d = dishes[i]
        await createMenuMaster({
          name: d.name,
          dish_category: d.dish_category,
          block_id: blockId,
          grams_per_person: d.grams_per_person,
          memo: d.memo,
          ingredients: d.ingredients,
        })
        saved++
      }
      onSuccess(saved)
    } catch {
      setError('登録の途中で止まりました。一覧を確認してから、残りをもう一度登録してください。')
    } finally {
      setSaving(false)
    }
  }

  const toggleAll = (v: boolean) => setSelected(dishes?.map(() => v) ?? [])
  const selectedCount = selected.filter(Boolean).length

  return (
    <div className="backdrop" role="dialog" aria-modal="true" aria-label="AIでメニューをまとめて作る">
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal__head">
          <h2>AIでメニューをまとめて作る</h2>
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
          <p className="muted" style={{ margin: '0 0 0.7rem', fontSize: 'var(--fs-sm)' }}>
            主食・主菜・副菜・汁物などをまとめて作り、選んだものだけ登録します。
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label className="field" style={{ marginBottom: 0, minWidth: 200 }}>
              <span>どのブロック向けに作りますか</span>
              <select
                className="select"
                value={blockId === null ? '' : String(blockId)}
                onChange={(e) => setBlockId(e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">共通（すべてのブロック）</option>
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}専用
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleGenerate}
              disabled={loading || saving}
            >
              {loading ? `作っています（${elapsedSec}秒）` : dishes ? 'もう一度作る' : 'メニューを作る'}
            </button>
          </div>

          {error && (
            <p className="notice notice--error" role="alert" style={{ marginTop: '0.8rem' }}>
              {error}
            </p>
          )}

          {dishes && !loading && (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  margin: '0.9rem 0 0.4rem',
                }}
              >
                <p style={{ margin: 0, fontWeight: 700, fontSize: 'var(--fs-sm)' }}>
                  <span className="num">{selectedCount}</span> / {dishes.length} 件を登録します
                </p>
                <div className="btnrow">
                  <button type="button" className="btn btn--sm" onClick={() => toggleAll(true)}>
                    すべて選ぶ
                  </button>
                  <button type="button" className="btn btn--sm" onClick={() => toggleAll(false)}>
                    選択を外す
                  </button>
                </div>
              </div>

              {dishes.map((dish, i) => (
                <label
                  key={i}
                  style={{
                    display: 'flex',
                    gap: '0.6rem',
                    alignItems: 'flex-start',
                    padding: '0.5rem 0.6rem',
                    marginBottom: '0.35rem',
                    border: '1px solid var(--rule)',
                    borderLeft: `4px solid ${selected[i] ? 'var(--ink)' : 'var(--rule)'}`,
                    borderRadius: 'var(--r)',
                    background: selected[i] ? 'var(--paper)' : 'var(--paper-alt)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected[i] ?? false}
                    onChange={(e) =>
                      setSelected((prev) => {
                        const a = [...prev]
                        a[i] = e.target.checked
                        return a
                      })
                    }
                    style={{ marginTop: '0.35rem' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700 }}>{dish.name}</span>
                      {dish.dish_category && <span className="tag tag--plain">{dish.dish_category}</span>}
                      {dish.grams_per_person > 0 && (
                        <span className="muted num" style={{ fontSize: 'var(--fs-sm)' }}>
                          {dish.grams_per_person}g/人
                        </span>
                      )}
                    </p>
                    {dish.ingredients.length > 0 && (
                      <p className="muted" style={{ margin: '0.15rem 0 0', fontSize: 'var(--fs-sm)' }}>
                        {dish.ingredients.map((ing) => ing.name).join('、')}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </>
          )}
        </div>

        {dishes && !loading && (
          <div className="modal__foot">
            <button type="button" className="btn" onClick={onClose}>
              やめる
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSave}
              disabled={saving || selectedCount === 0}
            >
              {saving ? '登録しています' : `${selectedCount}件を登録する`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
