#!/usr/bin/env bash
# LLM機（Ampere A1）に Ollama を入れる。
#
# なぜ別の機械に置くか:
#   アプリが動いている機械は 1GB しかなく、モデルが載らない。
#   A1 の無料枠（2OCPU/12GB）を丸ごとモデルに使う。
#
# Ollama には認証が無い。インターネットに出すと誰でも使える状態になるので、
#   - OCIのセキュリティリストでは 11434 を開けない
#   - iptables でアプリ機の内部IPだけ通す
#   - 待ち受けは内部IPのみ（公開IPでは待たない）
# の3段で閉じる。
#
# 使い方:
#   APP_IP=10.0.1.119 bash setup-ollama.sh
set -euo pipefail

APP_IP="${APP_IP:?アプリ機の内部IPを APP_IP で渡してください（例: 10.0.1.119）}"
MODEL="${MODEL:-qwen2.5:7b-instruct-q4_K_M}"
PRIVATE_IP="$(hostname -I | awk '{print $1}')"

echo "== この機械: ${PRIVATE_IP} / 通す相手: ${APP_IP} / モデル: ${MODEL}"

# ----------------------------------------
# 1. Ollama
# ----------------------------------------
if ! command -v ollama >/dev/null 2>&1; then
  echo "== Ollama を入れます"
  curl -fsSL https://ollama.com/install.sh | sh
else
  echo "== Ollama は導入済み"
fi

# ----------------------------------------
# 2. 待ち受けと常駐の設定
# ----------------------------------------
# OLLAMA_HOST: 内部IPだけで待つ。0.0.0.0 にすると公開IPでも待ってしまう
# OLLAMA_KEEP_ALIVE: GPUの無い機械ではモデルの読み込みに何十秒もかかる。
#   既定の5分で降ろされると、次の1件目が毎回それを待つことになるので常駐させる
# OLLAMA_NUM_PARALLEL / MAX_LOADED_MODELS: 2コアしかないので同時実行はしない
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/override.conf >/dev/null <<EOF
[Service]
Environment="OLLAMA_HOST=${PRIVATE_IP}:11434"
Environment="OLLAMA_KEEP_ALIVE=-1"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now ollama
sleep 3
sudo systemctl restart ollama
sleep 3

# ----------------------------------------
# 3. ファイアウォール
# ----------------------------------------
# Ubuntu の OCI イメージは既定で REJECT が最後に入っている。
# その REJECT より前に入れないと効かない。
REJECT_LINE="$(sudo iptables -L INPUT --line-numbers -n | awk '/REJECT/ {print $1; exit}')"
if [ -n "${REJECT_LINE}" ]; then
  if ! sudo iptables -C INPUT -s "${APP_IP}" -p tcp --dport 11434 -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT "${REJECT_LINE}" -s "${APP_IP}" -p tcp --dport 11434 -j ACCEPT
    echo "== iptables に ${APP_IP} からの 11434 を追加（${REJECT_LINE}行目）"
  else
    echo "== iptables は設定済み"
  fi
  sudo netfilter-persistent save >/dev/null 2>&1 || sudo sh -c 'iptables-save > /etc/iptables/rules.v4' 2>/dev/null || true
else
  echo "== REJECT が無いので iptables はそのまま"
fi

# ----------------------------------------
# 4. モデル
# ----------------------------------------
echo "== モデルを取得します（数GBあります）"
OLLAMA_HOST="${PRIVATE_IP}:11434" ollama pull "${MODEL}"

# ----------------------------------------
# 5. 動作確認と速度の実測
# ----------------------------------------
echo "== 応答を確認します"
START=$(date +%s)
RESP=$(curl -s "http://${PRIVATE_IP}:11434/api/generate" \
  -d "{\"model\":\"${MODEL}\",\"prompt\":\"次のJSONだけを返してください: {\\\"ok\\\":1}\",\"stream\":false,\"format\":\"json\"}" \
  --max-time 300)
END=$(date +%s)

echo "${RESP}" | head -c 300
echo
echo "== 応答まで $((END - START)) 秒"

echo
echo "次にアプリ機（${APP_IP}）の .env をこうします:"
echo "  AI_PROVIDER=ollama"
echo "  OLLAMA_BASE_URL=http://${PRIVATE_IP}:11434"
echo "  OLLAMA_MODEL=${MODEL}"
