#!/usr/bin/env bash
# setup.sh — どの環境でも一発でセットアップするスクリプト
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# ─── 1. .env ─────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "[setup] .env を .env.example からコピーします"
  cp .env.example .env
  echo "[setup] .env を作成しました。必要に応じて編集してください。"
else
  echo "[setup] .env は既に存在します。スキップします。"
fi

# ─── 2. Docker 起動 ───────────────────────────────────────────────────────────
echo "[setup] Docker コンテナを起動します..."
docker compose up -d --build

# ─── 3. DB マイグレーション ────────────────────────────────────────────────────
echo "[setup] DB の起動を待機します..."
until docker compose exec -T db mysqladmin ping -h localhost --silent; do
  printf "."
  sleep 2
done
echo ""

echo "[setup] マイグレーションを実行します..."
docker compose exec -T backend php /var/www/html/migrate.php

# ─── 4. Ollama モデル pull ────────────────────────────────────────────────────
OLLAMA_MODEL="${OLLAMA_MODEL:-qwen2.5:1.5b-instruct-q4_K_S}"
echo "[setup] Ollama モデル ($OLLAMA_MODEL) を pull します..."
if docker compose exec -T ollama ollama list | grep -q "$OLLAMA_MODEL"; then
  echo "[setup] モデルは既に存在します。スキップします。"
else
  docker compose exec -T ollama ollama pull "$OLLAMA_MODEL"
fi

echo ""
echo "[setup] セットアップ完了！"
echo "  フロントエンド: http://localhost:${FRONTEND_PORT:-3000}"
echo "  バックエンド API: http://localhost:${WEB_PORT:-80}/api"
