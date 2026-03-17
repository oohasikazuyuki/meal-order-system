.PHONY: setup up down restart logs ps migrate shell-backend shell-frontend shell-db

# デフォルト: ヘルプ表示
help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "  setup            初回セットアップ (.env 生成 / Docker 起動 / マイグレーション / Ollama pull)"
	@echo "  up               コンテナを起動"
	@echo "  down             コンテナを停止・削除"
	@echo "  restart          コンテナを再起動"
	@echo "  logs             全コンテナのログを tail"
	@echo "  ps               コンテナの状態確認"
	@echo "  migrate          DB マイグレーション実行"
	@echo "  shell-backend    バックエンドコンテナに入る"
	@echo "  shell-frontend   フロントエンドコンテナに入る"
	@echo "  shell-db         DB コンテナに入る"

# ─── セットアップ ─────────────────────────────────────────────────────────────
setup:
	@bash scripts/setup.sh

# ─── Docker 操作 ──────────────────────────────────────────────────────────────
up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

ps:
	docker compose ps

# ─── DB ──────────────────────────────────────────────────────────────────────
migrate:
	docker compose exec -T backend php /var/www/html/migrate.php

# ─── シェル ───────────────────────────────────────────────────────────────────
shell-backend:
	docker compose exec backend sh

shell-frontend:
	docker compose exec frontend sh

shell-db:
	docker compose exec db bash
