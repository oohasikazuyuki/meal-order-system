/**
 * 職員に渡すためのパスワードを作る。
 *
 * 管理者が他人のアカウントを作るので、作った本人が「何を設定したか」を
 * 相手に伝えられる必要がある。頭の中でひねり出すと弱いものになりやすく、
 * 入力欄は伏せ字なので打ち間違いにも気づけない。
 *
 * 紛らわしい文字（0/O/1/l/I）は外す。口頭やメモで伝えるため、
 * 読み違えると「ログインできない」という形で戻ってくる。
 */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generatePassword(length = 12): string {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]).join('')
}

/** ログインIDに使える形か。全角や記号が混じると本人が打てない */
export function validateLoginId(value: string): string | null {
  if (!value) return null
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    return '半角の英数字と . _ - だけが使えます'
  }
  if (value.length < 3) return '3文字以上にしてください'
  return null
}
