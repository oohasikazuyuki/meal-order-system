#!/usr/bin/env bash
# ドメインを当てて HTTPS にする。サーバー上で実行する。
#
#   DOMAIN=dev-hatchu.kamaho-shokusu.jp EMAIL=you@example.com ./setup-https.sh
#
# 前提: そのドメインのAレコードがこのサーバーのIPを指していること。
#       指していないと Let's Encrypt の確認が通らない。
set -euo pipefail

DOMAIN="${DOMAIN:?DOMAIN を指定してください}"
EMAIL="${EMAIL:?EMAIL を指定してください（証明書の期限通知先）}"
APP_DIR="${APP_DIR:-$HOME/meal-order}"

cd "$APP_DIR"

echo "==> DNS を確認"
resolved=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)
myip=$(curl -s --max-time 10 https://checkip.amazonaws.com || true)
echo "    $DOMAIN -> ${resolved:-未解決}"
echo "    このサーバー -> ${myip:-不明}"
if [ -z "$resolved" ]; then
  echo "!!  DNSが未反映です。Aレコードを追加して、反映を待ってから実行してください。"
  exit 1
fi
if [ -n "$myip" ] && [ "$resolved" != "$myip" ]; then
  echo "!!  DNSの向き先がこのサーバーと違います。証明書の取得に失敗します。"
  exit 1
fi

echo "==> ホスト側のポート開放を確認"
# Docker の公開ポートは INPUT チェーンを迂回するため、コンテナ経由のHTTPは
# INPUT が閉じていても通る。一方 certbot standalone はホストに直接bindするので
# INPUT を通る。OCIのUbuntuは 5番あたりに REJECT があり、その後ろに
# ACCEPT を足しても到達しない。REJECT より前に入れる。
reject_line=$(sudo iptables -L INPUT -n --line-numbers | awk '$2=="REJECT"{print $1; exit}')
if [ -n "$reject_line" ]; then
  for port in 80 443; do
    sudo iptables -D INPUT -m state --state NEW -p tcp --dport "$port" -j ACCEPT 2>/dev/null || true
  done
  reject_line=$(sudo iptables -L INPUT -n --line-numbers | awk '$2=="REJECT"{print $1; exit}')
  sudo iptables -I INPUT "$reject_line" -m state --state NEW -p tcp --dport 80 -j ACCEPT
  sudo iptables -I INPUT "$((reject_line + 1))" -m state --state NEW -p tcp --dport 443 -j ACCEPT
  sudo netfilter-persistent save >/dev/null 2>&1
  echo "    80/443 を REJECT より前に配置"
fi

echo "==> certbot を導入"
sudo apt-get update -qq
sudo apt-get install -y -qq certbot >/dev/null

echo "==> 証明書を取得（取得中だけ80番を空ける）"
sudo mkdir -p /var/www/certbot
# nginx コンテナを一旦止めて standalone で取る。
# webroot 方式にするには先にHTTPS設定が要り、鶏と卵になるため
sudo docker compose stop nginx
sudo certbot certonly --standalone \
  -d "$DOMAIN" \
  --non-interactive --agree-tos -m "$EMAIL" \
  --keep-until-expiring

echo "==> nginx の設定を HTTPS 用に差し替え"
sed "s|\${DOMAIN}|$DOMAIN|g" docker/nginx/prod-ssl.conf.template > docker/nginx/active.conf

echo "==> compose に証明書と443番を追加"
# デプロイのたびに同じ書き足しが要るので、処理は1か所にまとめてある
bash "$(dirname "$0")/apply-https-to-compose.sh"

echo "==> 起動"
sudo docker compose up -d nginx

echo "==> 自動更新を仕込む"
# 更新後に nginx を読み直さないと、古い証明書を掴んだままになる
sudo tee /etc/cron.d/certbot-renew >/dev/null <<CRON
0 4 * * * root certbot renew --quiet --pre-hook "cd $APP_DIR && docker compose stop nginx" --post-hook "cd $APP_DIR && docker compose start nginx"
CRON

echo
echo "完了: https://$DOMAIN"
echo "※ フロントは NEXT_PUBLIC_API_URL をビルド時に埋め込むため、"
echo "   https のURLで作り直す必要があります（手元で --build）。"
