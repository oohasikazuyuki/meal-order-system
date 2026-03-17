'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  fetchMenuMasters, createMenuMaster, updateMenuMaster, deleteMenuMaster,
  fetchBlocks, fetchSuppliers, draftMenuMasterByAi,
  type MenuMaster, type MenuMasterInput, type MenuIngredientInput, type Block, type Supplier, type AiMenuMasterDraftResponse,
} from '../_lib/api/client'

const UNIT_OPTIONS = ['g', 'kg', 'ml', 'L', '個', '枚', '本', '袋', '缶', '束', '合', '大さじ', '小さじ', '切れ', '適量']
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

const amountToFractionLabel = (amount: number): string | null => {
  const hit = FRACTION_OPTIONS.find(o => Math.abs(o.value - amount) < 0.001)
  return hit ? hit.label : null
}

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
  const [searchQuery, setSearchQuery] = useState('')
  const [filterBlockId, setFilterBlockId] = useState<number | null | 'all'>('all')

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
      setError('読み込み失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (m: MenuMaster) => {
    if (!confirm(`「${m.name}」を削除しますか？`)) return
    const prevMasters = masters
    setMasters(prev => prev.filter(x => x.id !== m.id))
    try {
      await deleteMenuMaster(m.id)
      setSuccessMsg(`「${m.name}」を削除しました`)
    } catch {
      setMasters(prevMasters)
      setError('削除に失敗しました')
    }
  }

  const handleSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setShowForm(false)
    setEditTarget(null)
    load()
  }

  // フィルタリング
  const filtered = masters.filter(m => {
    const matchText = m.name.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchText) return false
    if (filterBlockId === 'all') return true
    if (filterBlockId === null) return m.block_id === null
    return m.block_id === filterBlockId
  })

  const blockName = (id: number | null) => {
    if (id === null) return null
    return blocks.find(b => b.id === id)?.name ?? `ブロック${id}`
  }

  return (
    <div>
      {/* ヘッダー操作バー */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: '1rem 1.5rem',
        marginBottom: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="メニュー名で検索..."
          style={{
            flex: 1, minWidth: 140, padding: '0.5rem 0.75rem',
            fontSize: '0.9rem', border: '2px solid #e5e7eb', borderRadius: 8,
            outline: 'none', color: '#1a202c',
          }}
        />
        {/* ブロックフィルター */}
        <select
          value={filterBlockId === null ? '__common' : filterBlockId === 'all' ? 'all' : String(filterBlockId)}
          onChange={e => {
            const v = e.target.value
            if (v === 'all') setFilterBlockId('all')
            else if (v === '__common') setFilterBlockId(null)
            else setFilterBlockId(Number(v))
          }}
          style={{
            padding: '0.5rem 0.75rem', fontSize: '0.88rem',
            border: '2px solid #e5e7eb', borderRadius: 8, outline: 'none',
            background: '#fff', color: '#374151',
          }}
        >
          <option value="all">全ブロック</option>
          <option value="__common">共通（ブロック指定なし）</option>
          {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <span style={{ color: '#9ca3af', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
          {filtered.length} 件
        </span>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true); setError(null); setSuccessMsg(null) }}
          style={primaryBtn}
        >
          ＋ メニューを追加
        </button>
      </div>

      {error && <div style={alertStyle('error')}>⚠ {error}</div>}
      {successMsg && <div style={alertStyle('success')}>✓ {successMsg}</div>}

      {/* 追加・編集フォーム */}
      {showForm && (
        <MenuMasterForm
          initial={editTarget}
          blocks={blocks}
          suppliers={suppliers}
          onSuccess={handleSuccess}
          onCancel={() => { setShowForm(false); setEditTarget(null) }}
        />
      )}

      {/* 一覧 */}
      {loading ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '3rem', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          読み込み中...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '3rem', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🍽</div>
          {searchQuery ? '検索結果がありません' : 'メニューが登録されていません。「メニューを追加」から登録してください。'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map(m => (
            <MenuMasterCard
              key={m.id}
              master={m}
              blockName={blockName(m.block_id)}
              onEdit={() => { setEditTarget(m); setShowForm(true); setError(null); setSuccessMsg(null) }}
              onDelete={() => handleDelete(m)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ========================
// カード表示
// ========================
function MenuMasterCard({ master, blockName, onEdit, onDelete }: {
  master: MenuMaster
  blockName: string | null
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const ings = master.menu_ingredients ?? []

  return (
    <div style={{
      background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      border: '1px solid #f1f5f9', overflow: 'hidden',
    }}>
      <div style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* アイコン */}
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: blockName
            ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
            : 'linear-gradient(135deg, #1a3a5c, #2563eb)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.2rem', flexShrink: 0,
        }}>🍽</div>

        {/* 情報 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1a202c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {master.name}
            {blockName ? (
              <span style={{
                fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: 4,
                background: '#ede9fe', color: '#6d28d9', fontWeight: 600,
              }}>
                🏠 {blockName}専用
              </span>
            ) : (
              <span style={{
                fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: 4,
                background: '#f0f9ff', color: '#0369a1', fontWeight: 600,
              }}>
                共通
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: '0.15rem', display: 'flex', gap: '1rem' }}>
            <span>1人あたり <strong style={{ color: '#374151' }}>{master.grams_per_person}g</strong></span>
            <span>材料 <strong style={{ color: '#374151' }}>{ings.length}品目</strong></span>
            {master.memo && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{master.memo}</span>}
          </div>
        </div>

        {/* 操作 */}
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          {ings.length > 0 && (
            <button
              onClick={() => setOpen(o => !o)}
              style={{
                padding: '0.3rem 0.75rem', fontSize: '0.8rem',
                background: open ? '#eff6ff' : '#f3f4f6',
                color: open ? '#2563eb' : '#6b7280',
                border: `1px solid ${open ? '#bfdbfe' : '#e5e7eb'}`,
                borderRadius: 6, cursor: 'pointer', fontWeight: 500,
              }}
            >
              材料 {open ? '▲' : '▼'}
            </button>
          )}
          <button onClick={onEdit} style={editBtn}>編集</button>
          <button onClick={onDelete} style={deleteBtn}>削除</button>
        </div>
      </div>

      {/* 材料展開 */}
      {open && ings.length > 0 && (
        <div style={{ padding: '0.75rem 1.5rem 1rem', borderTop: '1px dashed #e2e8f0', background: '#f8fafc' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase' }}>材料リスト</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {ings.map(ing => (
              <span key={ing.id} style={{
                background: ing.persons_per_unit ? '#fffbeb' : '#fff',
                border: `1px solid ${ing.persons_per_unit ? '#fcd34d' : '#e5e7eb'}`,
                borderRadius: 6,
                padding: '0.25rem 0.65rem', fontSize: '0.82rem', color: '#374151',
              }}>
                {ing.name}{' '}
                {ing.persons_per_unit
                  ? <span style={{ color: '#d97706', fontWeight: 600 }}>{ing.persons_per_unit}人で1{ing.unit}</span>
                  : ing.amount > 0 ? `${formatAmountLabel(ing.amount)}${ing.unit}` : ing.unit
                }
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ========================
// 追加・編集フォーム
// ========================
function MenuMasterForm({ initial, blocks, suppliers, onSuccess, onCancel }: {
  initial: MenuMaster | null
  blocks: Block[]
  suppliers: Supplier[]
  onSuccess: (msg: string) => void
  onCancel: () => void
}) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [blockId, setBlockId] = useState<number | null>(initial?.block_id ?? null)
  const [grams, setGrams] = useState(String(initial?.grams_per_person ?? ''))
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [ingredients, setIngredients] = useState<MenuIngredientInput[]>(
    initial?.menu_ingredients?.map(i => ({ name: i.name, amount: i.amount, unit: i.unit, persons_per_unit: i.persons_per_unit ?? null, supplier_id: i.supplier_id ?? null })) ?? [{ name: '', amount: 0, unit: 'g', persons_per_unit: null, supplier_id: null }]
  )
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiElapsedSec, setAiElapsedSec] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [aiInfo, setAiInfo] = useState<string | null>(null)

  const addIngRow = () => setIngredients(prev => [...prev, { name: '', amount: 0, unit: 'g', persons_per_unit: null, supplier_id: null }])
  const removeIngRow = (idx: number) => setIngredients(prev => prev.filter((_, i) => i !== idx))
  const updateIng = (idx: number, patch: Partial<MenuIngredientInput>) =>
    setIngredients(prev => { const a = [...prev]; a[idx] = { ...a[idx], ...patch }; return a })

  useEffect(() => {
    if (!aiLoading) return
    setAiElapsedSec(0)
    const started = Date.now()
    const timer = setInterval(() => {
      setAiElapsedSec(Math.floor((Date.now() - started) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [aiLoading])

  const applyAiDraft = (draft: AiMenuMasterDraftResponse['draft']) => {
    setGrams(String(draft.grams_per_person ?? 0))
    setMemo(draft.memo ?? '')
    if (Array.isArray(draft.ingredients) && draft.ingredients.length > 0) {
      setIngredients(
        draft.ingredients.map(i => ({
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
      const res = await draftMenuMasterByAi({
        name: name.trim() || undefined,
        block_id: blockId,
      })
      const body: AiMenuMasterDraftResponse = res.data
      if (!body.ok || !body.draft) {
        setError(body.message || 'AI下書きの取得に失敗しました')
        return
      }
      if (body.name && body.name.trim()) {
        setName(body.name.trim())
      }
      applyAiDraft(body.draft)
      if (body.name_generated) {
        setAiInfo('AIが料理名を生成しました。必要なら編集してください。')
      }
    } catch {
      setError('AI下書きの取得に失敗しました（Ollama起動状態を確認してください）')
    } finally {
      setAiLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('メニュー名は必須です'); return }
    setSaving(true)
    setError(null)
    try {
      const data: MenuMasterInput = {
        name: name.trim(),
        block_id: blockId,
        grams_per_person: parseFloat(grams) || 0,
        memo: memo.trim(),
        ingredients: ingredients.filter(i => i.name.trim()),
      }
      if (isEdit && initial) {
        await updateMenuMaster(initial.id, data)
        onSuccess(`「${name}」を更新しました`)
      } else {
        await createMenuMaster(data)
        onSuccess(`「${name}」を追加しました`)
      }
    } catch {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      padding: '1.5rem', marginBottom: '1.5rem', border: '2px solid #e5e7eb',
    }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1a202c' }}>
            {isEdit ? '✏ メニューを編集' : '＋ メニューを追加'}
          </h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1.2rem' }}>✕</button>
        </div>

      {error && <div style={{ ...alertStyle('error'), marginBottom: '1rem' }}>⚠ {error}</div>}
      {AI_PUBLIC_ENABLED && aiInfo && <div style={{ ...alertStyle('success'), marginBottom: '1rem' }}>✓ {aiInfo}</div>}
      {AI_PUBLIC_ENABLED && aiLoading && (
        <div style={{ ...alertStyle('success'), marginBottom: '1rem', color: '#0f766e', borderColor: '#99f6e4', background: '#f0fdfa' }}>
          AIが下書きを生成中です... {aiElapsedSec}秒経過
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* 基本情報 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label style={labelStyle}>メニュー名 <span style={{ color: '#dc2626' }}>*</span></label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="例：おかゆ定食"
                style={formInput}
                autoFocus
              />
              {AI_PUBLIC_ENABLED && (
                <button
                  type="button"
                  onClick={handleAiDraft}
                  disabled={aiLoading || saving}
                  style={{
                    padding: '0.5rem 0.7rem',
                    background: aiLoading ? '#94a3b8' : '#0f766e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: aiLoading || saving ? 'not-allowed' : 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {aiLoading ? '生成中...' : 'AI下書き'}
                </button>
              )}
            </div>
          </div>
          <div>
            <label style={labelStyle}>対象ブロック</label>
            <select
              value={blockId === null ? '' : String(blockId)}
              onChange={e => setBlockId(e.target.value === '' ? null : Number(e.target.value))}
              style={{ ...formInput, cursor: 'pointer' }}
            >
              <option value="">共通（全ブロック）</option>
              {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>1人あたり (g)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="number"
                min={0}
                step={0.1}
                value={grams}
                onChange={e => setGrams(e.target.value)}
                placeholder="0"
                style={{ ...formInput, textAlign: 'right' }}
              />
              <span style={{ color: '#9ca3af', fontSize: '0.85rem', flexShrink: 0 }}>g</span>
            </div>
          </div>
          <div>
            <label style={labelStyle}>メモ</label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="備考・説明など"
              style={formInput}
            />
          </div>
        </div>

        {/* 材料 */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}>
            <label style={{ ...labelStyle, margin: 0 }}>材料リスト</label>
            <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>（省略可）</span>
          </div>
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '0.75rem', border: '1px solid #e5e7eb' }}>
            {/* ヘッダー行 */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.3rem', alignItems: 'center', fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600 }}>
              <span style={{ flex: 1 }}>材料名</span>
              <span style={{ width: 70, textAlign: 'right' }}>量</span>
              <span style={{ width: 70 }}>単位</span>
              <span style={{ width: 110, textAlign: 'center' }}>何人で1単位</span>
              <span style={{ minWidth: 80 }}>仕入先</span>
              <span style={{ width: 28 }}></span>
            </div>
            {ingredients.map((ing, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', alignItems: 'center' }}>
                <input
                  type="text"
                  value={ing.name}
                  onChange={e => updateIng(idx, { name: e.target.value })}
                  placeholder="材料名"
                  style={{ flex: 1, padding: '0.35rem 0.6rem', fontSize: '0.85rem', border: '1px solid #e5e7eb', borderRadius: 6, outline: 'none' }}
                />
                {/* persons_per_unit が未設定の場合のみ amount を表示 */}
                {!ing.persons_per_unit && (
                  FRACTION_UNITS.has(ing.unit) ? (
                    <select
                      value={amountToFractionLabel(ing.amount) ?? ''}
                      onChange={e => updateIng(idx, { amount: parseAmountInput(e.target.value || '0') })}
                      style={{ width: 70, padding: '0.35rem 0.4rem', fontSize: '0.82rem', border: '1px solid #e5e7eb', borderRadius: 6, outline: 'none', background: '#fff' }}
                    >
                      <option value="">選択</option>
                      {FRACTION_OPTIONS.map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={ing.amount || ''}
                      onChange={e => updateIng(idx, { amount: parseAmountInput(e.target.value) })}
                      placeholder="量（例: 0.5 / 1/2）"
                      style={{ width: 70, padding: '0.35rem 0.5rem', fontSize: '0.85rem', border: '1px solid #e5e7eb', borderRadius: 6, outline: 'none', textAlign: 'right' }}
                    />
                  )
                )}
                {ing.persons_per_unit && (
                  <div style={{ width: 70, fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center' }}>—</div>
                )}
                <select
                  value={ing.unit}
                  onChange={e => updateIng(idx, { unit: e.target.value })}
                  style={{ width: 70, padding: '0.35rem 0.4rem', fontSize: '0.82rem', border: '1px solid #e5e7eb', borderRadius: 6, outline: 'none', background: '#fff' }}
                >
                  {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                {/* 何人で1単位 */}
                <div style={{ width: 110, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={ing.persons_per_unit ?? ''}
                    onChange={e => updateIng(idx, { persons_per_unit: e.target.value === '' ? null : parseInt(e.target.value) })}
                    placeholder="例: 3"
                    title="何人で1単位か（例: 3人で1束）"
                    style={{ width: 50, padding: '0.35rem 0.4rem', fontSize: '0.85rem', border: `1px solid ${ing.persons_per_unit ? '#fcd34d' : '#e5e7eb'}`, borderRadius: 6, outline: 'none', textAlign: 'right', background: ing.persons_per_unit ? '#fffbeb' : '#fff' }}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                    人/{ing.unit || '単位'}
                  </span>
                </div>
                <select
                  value={ing.supplier_id ?? ''}
                  onChange={e => updateIng(idx, { supplier_id: e.target.value === '' ? null : Number(e.target.value) })}
                  style={{ padding: '0.35rem 0.4rem', fontSize: '0.82rem', border: '1px solid #e5e7eb', borderRadius: 6, outline: 'none', background: '#fff', minWidth: 80 }}
                >
                  <option value="">仕入先</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => removeIngRow(idx)}
                  style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 5, cursor: 'pointer', padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                >✕</button>
              </div>
            ))}
            <button
              type="button"
              onClick={addIngRow}
              style={{ marginTop: '0.25rem', padding: '0.3rem 0.9rem', fontSize: '0.8rem', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', color: '#374151' }}
            >
              ＋ 材料を追加
            </button>
          </div>
        </div>

        {/* ブロック説明 */}
        {blockId !== null && (
          <div style={{ marginBottom: '1rem', padding: '0.6rem 0.9rem', background: '#ede9fe', borderRadius: 8, fontSize: '0.82rem', color: '#6d28d9' }}>
            ★ このメニューは「{blocks.find(b => b.id === blockId)?.name}」専用として献立管理に表示されます
          </div>
        )}
        {blockId === null && (
          <div style={{ marginBottom: '1rem', padding: '0.6rem 0.9rem', background: '#f0f9ff', borderRadius: 8, fontSize: '0.82rem', color: '#0369a1' }}>
            共通メニューは全ブロックの献立入力で選択できます
          </div>
        )}

        {/* ボタン */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} style={cancelBtn}>キャンセル</button>
          <button type="submit" disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
            {saving ? '保存中...' : isEdit ? '更新' : '追加'}
          </button>
        </div>
      </form>
    </div>
  )
}

// --- Styles ---
function alertStyle(type: 'error' | 'success'): React.CSSProperties {
  return {
    background: type === 'error' ? '#fef2f2' : '#f0fdf4',
    border: `1px solid ${type === 'error' ? '#fca5a5' : '#86efac'}`,
    borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem',
    color: type === 'error' ? '#dc2626' : '#16a34a', fontSize: '0.9rem',
  }
}
const primaryBtn: React.CSSProperties = { padding: '0.55rem 1.25rem', background: '#1a3a5c', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }
const cancelBtn: React.CSSProperties = { padding: '0.55rem 1.25rem', background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }
const editBtn: React.CSSProperties = { padding: '0.3rem 0.75rem', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }
const deleteBtn: React.CSSProperties = { padding: '0.3rem 0.75rem', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.4rem', fontWeight: 600, color: '#374151', fontSize: '0.85rem' }
const formInput: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.9rem', border: '2px solid #e5e7eb', borderRadius: 8, outline: 'none', color: '#1a202c', boxSizing: 'border-box' }
