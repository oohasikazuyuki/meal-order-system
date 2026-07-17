# meal-order-system

## Docker 起動

### 1. 環境変数ファイルを作成
```bash
cp .env.example .env
```

### 2. 起動
```bash
docker compose up -d --build
```

## 複数セット同時起動（ポート競合回避）

`docker-compose.yml` は以下のホスト側ポートを環境変数で変更できます。

- `WEB_PORT` (default: `80`)
- `FRONTEND_PORT` (default: `3000`)
- `DB_PORT` (default: `3306`)

例: 1セット目（標準ポート）
```bash
docker compose --env-file .env -p meal1 up -d --build
```

例: 2セット目（別ポート）
```bash
cat > .env.instance2 <<'EOF'
KAMAHO_BASE_URL=https://kamaho-shokusu.jp/kamaho-shokusu
KAMAHO_LOGIN_ACCOUNT=your_account
KAMAHO_LOGIN_PASSWORD=your_password
MYSQL_ROOT_PASSWORD=rootpass
MYSQL_DATABASE=meal_order_db
MYSQL_USER=cake_user
MYSQL_PASSWORD=secret
WEB_PORT=8080
FRONTEND_PORT=3001
DB_PORT=3307
EOF

docker compose --env-file .env.instance2 -p meal2 up -d --build
```

補足:
- `-p` を変えることで、ネットワーク/ボリューム名も分離されます。
- `NEXT_PUBLIC_API_URL` は `WEB_PORT` に連動して `http://localhost:${WEB_PORT}/api` が使われます。

## AI メニュー提案 API

OpenRouter（既定モデル: `openai/gpt-oss-20b:free`）を使い、献立提案とメニューマスタ下書きを生成します。

`.env` の設定例:
```env
AI_PUBLIC_ENABLED=true
NEXT_PUBLIC_AI_PUBLIC_ENABLED=true
AI_PROVIDER=openrouter
OPENROUTER_MODEL=openai/gpt-oss-20b:free
OPENROUTER_API_KEY=sk-or-...
```

バックエンド API:
- `POST /api/ai/menu-suggest`
  - 入力: `date`, `block_id`, `existing_by_meal`
  - 出力: 食事種別ごとの新規献立名（メニューマスタ未登録でも可）
- `POST /api/ai/menu-master-draft`
  - 入力: `name`, `block_id`
  - 出力: 食材・分量などの下書き

LLM プロバイダは `.env` の `AI_PROVIDER`（`openrouter` / `groq`）で切り替えます。