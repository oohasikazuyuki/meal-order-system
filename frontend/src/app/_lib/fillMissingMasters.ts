import {
  fetchMenuMasters,
  draftMenuMasterByAi,
  createMenuMaster,
  type MenuItem,
  type MenuMaster,
} from './api/client'

/** 献立に使われているのに、メニューマスタが無い名前 */
export type MissingMaster = { name: string; dishCategory: string | null; blockId: number | null }

export type FillProgress = { done: number; total: number; name: string }

export type FillResult = {
  created: number
  failed: string[]
  /** 1日のAI無料枠を使い切って打ち切った */
  quotaExhausted?: boolean
}

/** 無料枠切れ（429）かどうか。待っても再実行しても変わらないので、そこで止める */
function isQuotaExhausted(err: unknown): boolean {
  const res = (err as { response?: { status?: number; data?: { error?: { details?: { quota_exhausted?: boolean } } } } })
    ?.response
  return res?.status === 429 || res?.data?.error?.details?.quota_exhausted === true
}

/**
 * マスタの有無は献立表・発注書と同じ条件で見る。
 * （そのブロック専用のマスタ、または全ブロック共通のマスタ）
 */
function hasMaster(masters: MenuMaster[], name: string, blockId: number | null): boolean {
  return masters.some((m) => m.name === name && (m.block_id === blockId || m.block_id === null))
}

/**
 * 献立のうち、マスタが無いものを名前ごとに1件へまとめて返す。
 *
 * 同じ名前が何日も、何ブロックにも出てくる（麦ごはんは10日分ある）。
 * AIは名前ごとに1回呼べば足りるので、ここで重複を落としておく。
 * 無料枠は50回/日しかない。
 *
 * その名前のマスタがまだ1件も無ければ、全ブロック共通として作る。
 * 既存18件もすべて共通で登録されている。
 *
 * 同名で「共通」と「ブロック専用」が両方あると、献立表・発注書の結合
 * （block_id が一致 OR NULL）に2件とも当たって材料が二重に数えられる。
 * そうならないよう、同名のマスタが既にあるときだけブロック別に作る。
 */
export function findMissingMasters(menus: MenuItem[], masters: MenuMaster[]): MissingMaster[] {
  const sameName = (name: string) => masters.some((m) => m.name === name)
  const seen = new Set<string>()
  const out: MissingMaster[] = []
  for (const menu of menus) {
    const menuBlockId = menu.block_id ?? null
    if (hasMaster(masters, menu.name, menuBlockId)) continue
    const blockId = sameName(menu.name) ? menuBlockId : null
    const key = `${menu.name} ${blockId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ name: menu.name, dishCategory: menu.dish_category ?? null, blockId })
  }
  return out
}

/**
 * マスタが無い献立に、AIで材料を付けて登録する。
 *
 * 材料が無い献立は発注書に一切出てこない。つまりその食材は発注されない。
 * 献立だけ先に作ると、紙が厨房に渡ってから気づくことになる。
 *
 * AIが決めた数量はそのまま発注量になるので、作ったマスタには needs_review を立てる。
 * 発注書の画面で、出す前に知らせるために使う。
 */
export async function fillMissingMasters(
  missing: MissingMaster[],
  onProgress?: (p: FillProgress) => void,
  supplierIds?: number[]
): Promise<FillResult> {
  const failed: string[] = []
  let created = 0

  for (let i = 0; i < missing.length; i++) {
    const item = missing[i]
    onProgress?.({ done: i, total: missing.length, name: item.name })
    try {
      const res = await draftMenuMasterByAi({
        name: item.name,
        block_id: item.blockId,
        supplier_ids: supplierIds,
      })
      const draft = res.data?.draft
      if (!draft) {
        failed.push(item.name)
        continue
      }
      await createMenuMaster({
        name: item.name,
        dish_category: item.dishCategory,
        block_id: item.blockId,
        grams_per_person: draft.grams_per_person,
        memo: draft.memo,
        ingredients: draft.ingredients,
        needs_review: true,
      })
      created++
    } catch (err) {
      // 枠切れは残りを試しても全部同じ結果になる。20分かけて全滅するより、
      // ここで止めて「何件残っているか」を伝えたほうがよい
      if (isQuotaExhausted(err)) {
        onProgress?.({ done: i, total: missing.length, name: '' })
        return { created, failed: missing.slice(i).map((m) => m.name), quotaExhausted: true }
      }
      failed.push(item.name)
    }
  }
  onProgress?.({ done: missing.length, total: missing.length, name: '' })
  return { created, failed }
}

/** 献立とマスタを読み直して、足りない分を埋める */
export async function fillMissingMastersFor(
  menus: MenuItem[],
  onProgress?: (p: FillProgress) => void,
  supplierIds?: number[]
): Promise<FillResult & { missing: number }> {
  const masters = (await fetchMenuMasters()).data?.menu_masters ?? []
  const missing = findMissingMasters(menus, masters)
  if (missing.length === 0) return { created: 0, failed: [], missing: 0 }
  const res = await fillMissingMasters(missing, onProgress, supplierIds)
  return { ...res, missing: missing.length }
}
