'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  fetchMenuMasters, createMenuMaster, updateMenuMaster, deleteMenuMaster,
  fetchBlocks,
  type MenuMaster, type MenuMasterInput, type MenuIngredientInput, type Block,
} from '../_lib/api/client'

const UNIT_OPTIONS = ['g', 'kg', 'ml', 'L', '個', '枚', '本', '袋', '缶', '合', '大さじ', '小さじ', '適量']

export default function MenuMasterPage() {
  const [masters, setMasters] = useState<MenuMaster[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
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
      const [mastersRes, blocksRes] = await Promise.all([
        fetchMenuMasters(),
        fetchBlocks(),
      ])
      setMasters(mastersRes.data.menu_masters)
      setBlocks(blocksRes.data.blocks)
    } catch {
      setError('読み込み失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (m: MenuMaster) => {
    if (!confirm(`「${m.name}」を削除しますか？`)) return
    try {
      await deleteMenuMaster(m.id)
      setSuccessMsg(`「${m.name}」を削除しました`)
      load()
    } catch {
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
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6,
                padding: '0.25rem 0.65rem', fontSize: '0.82rem', color: '#374151',
              }}>
                {ing.name} {ing.amount > 0 ? `${ing.amount}${ing.unit}` : ing.unit}
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
function MenuMasterForm({ initial, blocks, onSuccess, onCancel }: {
  initial: MenuMaster | null
  blocks: Block[]
  onSuccess: (msg: string) => void
  onCancel: () => void
}) {
  const isEdit = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [blockId, setBlockId] = useState<number | null>(initial?.block_id ?? null)
  const [grams, setGrams] = useState(String(initial?.grams_per_person ?? ''))
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [ingredients, setIngredients] = useState<MenuIngredientInput[]>(
    initial?.menu_ingredients?.map(i => ({ name: i.name, amount: i.amount, unit: i.unit })) ?? [{ name: '', amount: 0, unit: 'g' }]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addIngRow = () => setIngredients(prev => [...prev, { name: '', amount: 0, unit: 'g' }])
  const removeIngRow = (idx: number) => setIngredients(prev => prev.filter((_, i) => i !== idx))
  const updateIng = (idx: number, patch: Partial<MenuIngredientInput>) =>
    setIngredients(prev => { const a = [...prev]; a[idx] = { ...a[idx], ...patch }; return a })

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

      <form onSubmit={handleSubmit}>
        {/* 基本情報 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label style={labelStyle}>メニュー名 <span style={{ color: '#dc2626' }}>*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例：おかゆ定食"
              style={formInput}
              autoFocus
            />
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
            {ingredients.map((ing, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', alignItems: 'center' }}>
                <input
                  type="text"
                  value={ing.name}
                  onChange={e => updateIng(idx, { name: e.target.value })}
                  placeholder="材料名"
                  style={{ flex: 1, padding: '0.35rem 0.6rem', fontSize: '0.85rem', border: '1px solid #e5e7eb', borderRadius: 6, outline: 'none' }}
                />
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={ing.amount || ''}
                  onChange={e => updateIng(idx, { amount: parseFloat(e.target.value) || 0 })}
                  placeholder="量"
                  style={{ width: 70, padding: '0.35rem 0.5rem', fontSize: '0.85rem', border: '1px solid #e5e7eb', borderRadius: 6, outline: 'none', textAlign: 'right' }}
                />
                <select
                  value={ing.unit}
                  onChange={e => updateIng(idx, { unit: e.target.value })}
                  style={{ padding: '0.35rem 0.4rem', fontSize: '0.82rem', border: '1px solid #e5e7eb', borderRadius: 6, outline: 'none', background: '#fff' }}
                >
                  {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
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
