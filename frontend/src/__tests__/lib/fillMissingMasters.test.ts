import { describe, it, expect } from 'vitest'
import { findMissingMasters } from '@/app/_lib/fillMissingMasters'
import type { MenuItem, MenuMaster } from '@/app/_lib/api/client'

const menu = (name: string, blockId: number | null, date = '2026-10-02') =>
  ({ name, block_id: blockId, menu_date: date, meal_type: 2, dish_category: '主食' }) as MenuItem

const master = (name: string, blockId: number | null) =>
  ({ id: 1, name, block_id: blockId, dish_category: null, grams_per_person: 0, memo: '' }) as MenuMaster

describe('findMissingMasters', () => {
  it('マスタがある献立は拾わない', () => {
    expect(findMissingMasters([menu('ごはん', 3)], [master('ごはん', 3)])).toEqual([])
  })

  // 献立表・発注書の結合条件と同じ。全ブロック共通のマスタはどのブロックでも使える
  it('全ブロック共通のマスタはどのブロックでも使える', () => {
    expect(findMissingMasters([menu('ごはん', 3)], [master('ごはん', null)])).toEqual([])
  })

  // 同名で「共通」と「ブロック専用」が両方あると、献立表・発注書の結合が
  // 2件とも拾って材料が二重に数えられる。だから同名があるときだけブロック別に作る
  it('別ブロック専用のマスタがあるときは、そのブロック専用として作る', () => {
    expect(findMissingMasters([menu('ごはん', 3)], [master('ごはん', 4)])).toEqual([
      { name: 'ごはん', dishCategory: '主食', blockId: 3 },
    ])
  })

  it('同名のマスタが1件も無ければ、全ブロック共通として作る', () => {
    expect(findMissingMasters([menu('豚汁', 3)], [])).toEqual([
      { name: '豚汁', dishCategory: '主食', blockId: null },
    ])
  })

  // 麦ごはんは10日分ある。AIは名前ごとに1回呼べば足りる（無料枠は50回/日）
  it('同じ名前が何日あっても1件にまとめる', () => {
    const menus = [
      menu('麦ごはん', 3, '2026-10-02'),
      menu('麦ごはん', 3, '2026-10-03'),
      menu('麦ごはん', 3, '2026-10-04'),
    ]
    expect(findMissingMasters(menus, [])).toEqual([
      { name: '麦ごはん', dishCategory: '主食', blockId: null },
    ])
  })

  // 無料枠は50回/日。ブロックの数だけAIを呼ぶと、それだけで枯れる
  it('ブロックが違っても共通マスタ1件にまとめる', () => {
    const menus = [menu('豚汁', 3), menu('豚汁', 4)]
    expect(findMissingMasters(menus, [])).toEqual([
      { name: '豚汁', dishCategory: '主食', blockId: null },
    ])
  })

  // 「麦ごはん」と「麦飯」は別の文字列なので別物として扱う。
  // 表記ゆれの統合は人が見て決めること（誤って混ぜると発注が狂う）
  it('表記ゆれは別のメニューとして扱う', () => {
    const menus = [menu('麦ごはん', 3), menu('麦飯', 3)]
    expect(findMissingMasters(menus, []).map((m) => m.name)).toEqual(['麦ごはん', '麦飯'])
  })
})
