#!/usr/bin/env bash
# MySQL を毎日ダンプする。cron から呼ぶ（登録は deploy.yml が行う）。
#
#   bash deploy/backup-db.sh
#
# 出力先: ~/meal-order/backups/meal_order_db-YYYYmmdd-HHMM.sql.gz
# KEEP_DAYS 日より古いものは消す。戻し方は deploy/README.md の「バックアップ」。
#
# 資格情報は db コンテナの環境変数（= .env から渡したもの）をコンテナ内で
# 読むだけで、こちら側の引数やログには出さない。
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/meal-order}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
export TZ=Asia/Tokyo   # サーバーは UTC。ファイル名は日本時間で付ける

cd "$APP_DIR"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"   # 中身は DB 丸ごと。他のユーザーに読ませない

out="$BACKUP_DIR/meal_order_db-$(date +%Y%m%d-%H%M).sql.gz"
tmp="$(mktemp "$BACKUP_DIR/.partial.XXXXXX")"
trap 'rm -f "$tmp"' EXIT

# --single-transaction: 止めずに一貫した状態を取る（InnoDB）
# --quick: 1行ずつ流す。1GB機なので結果をメモリに溜めない
# 圧縮はホスト側の gzip。コンテナ内に一時ファイルは作らない
docker compose exec -T db sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot \
     --single-transaction --quick --routines --triggers --no-tablespaces \
     "$MYSQL_DATABASE"' \
  | gzip -c > "$tmp"

# 途中で切れたダンプは末尾の完了行が無い
gunzip -c "$tmp" | tail -n 1 | grep -q '^-- Dump completed' \
  || { echo "ダンプが途中で切れています" >&2; exit 1; }

mv "$tmp" "$out"
echo "$(date '+%F %T') 保存: $out ($(du -h "$out" | cut -f1))"

find "$BACKUP_DIR" -name 'meal_order_db-*.sql.gz' -mtime +"$KEEP_DAYS" -print -delete
