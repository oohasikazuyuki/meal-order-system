// 祝日計算の自己チェック。内閣府が公示した 2026年・2027年の祝日と突き合わせる。
// 実行: node scripts/check-holiday.mjs
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'

const out = mkdtempSync(join(tmpdir(), 'holiday-'))
try {
  execFileSync(
    'npx',
    ['tsc', 'src/app/_lib/holiday.ts', 'src/app/_lib/date.ts',
     // commonjs で出す。拡張子なしの import を node がそのまま解決できる
     '--outDir', out, '--module', 'commonjs', '--target', 'es2020'],
    { stdio: 'inherit' }
  )
  const { getHoliday, isClosedDay } = createRequire(import.meta.url)(join(out, 'holiday.js'))

  // 内閣府「国民の祝日について」より
  const EXPECTED = {
    2026: {
      '2026-01-01': '元日', '2026-01-12': '成人の日', '2026-02-11': '建国記念の日',
      '2026-02-23': '天皇誕生日', '2026-03-20': '春分の日', '2026-04-29': '昭和の日',
      '2026-05-03': '憲法記念日', '2026-05-04': 'みどりの日', '2026-05-05': 'こどもの日',
      '2026-05-06': '振替休日', '2026-07-20': '海の日', '2026-08-11': '山の日',
      '2026-09-21': '敬老の日', '2026-09-22': '国民の休日', '2026-09-23': '秋分の日',
      '2026-10-12': 'スポーツの日', '2026-11-03': '文化の日', '2026-11-23': '勤労感謝の日',
    },
    2027: {
      '2027-01-01': '元日', '2027-01-11': '成人の日', '2027-02-11': '建国記念の日',
      '2027-02-23': '天皇誕生日', '2027-03-21': '春分の日', '2027-03-22': '振替休日',
      '2027-04-29': '昭和の日', '2027-05-03': '憲法記念日', '2027-05-04': 'みどりの日',
      '2027-05-05': 'こどもの日', '2027-07-19': '海の日', '2027-08-11': '山の日',
      '2027-09-20': '敬老の日', '2027-09-23': '秋分の日', '2027-10-11': 'スポーツの日',
      '2027-11-03': '文化の日', '2027-11-23': '勤労感謝の日',
    },
  }

  for (const [year, expected] of Object.entries(EXPECTED)) {
    // その年の全日をなめて、祝日の集合が一致することを確かめる
    const got = {}
    for (let m = 0; m < 12; m++) {
      for (let d = 1; d <= 31; d++) {
        const date = new Date(Number(year), m, d)
        if (date.getMonth() !== m) break
        const key = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const name = getHoliday(key)
        if (name) got[key] = name
      }
    }
    assert.deepEqual(got, expected, `${year}年の祝日が公示と一致しない`)
  }

  // 平日・土日の判定
  assert.equal(getHoliday('2026-09-24'), null)
  assert.equal(isClosedDay('2026-09-24'), false) // 木曜
  assert.equal(isClosedDay('2026-09-26'), true)  // 土曜
  assert.equal(isClosedDay('2026-09-27'), true)  // 日曜
  assert.equal(isClosedDay('2026-09-22'), true)  // 国民の休日

  console.log('祝日チェック OK（2026年・2027年）')
} finally {
  rmSync(out, { recursive: true, force: true })
}
