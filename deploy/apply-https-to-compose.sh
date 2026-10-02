#!/usr/bin/env bash
# docker-compose.yml に 443番と証明書のマウントを入れ直す。
#
# setup-https.sh が最初に書き足すが、デプロイでリポジトリの素のファイルを
# 送ると消える。消えると 443 を公開しなくなり、サイトに繋がらなくなる。
# 証明書が無い機械では何もしない（HTTPのままで動く）。
#
# 何度流しても同じ結果になる。
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d /etc/letsencrypt/live ] || [ ! -f docker/nginx/active.conf ]; then
  echo "証明書か active.conf が無いので、HTTPSの書き足しは行いません"
  exit 0
fi

python3 - <<'PY'
import pathlib
p = pathlib.Path('docker-compose.yml')
s = p.read_text()
before = s
if '443:443' not in s:
    s = s.replace('      - "80:80"', '      - "80:80"\n      - "443:443"', 1)
if 'letsencrypt' not in s:
    s = s.replace(
        '      - ./docker/nginx/prod.conf:/etc/nginx/conf.d/default.conf:ro',
        '      - ./docker/nginx/active.conf:/etc/nginx/conf.d/default.conf:ro\n'
        '      - /etc/letsencrypt:/etc/letsencrypt:ro\n'
        '      - /var/www/certbot:/var/www/certbot:ro', 1)
if s != before:
    p.write_text(s)
    print('    compose に443番と証明書を入れ直しました')
else:
    print('    compose は既にHTTPS用です')
PY
