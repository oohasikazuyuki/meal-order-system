# OCI に Dev 環境を作る

## 前提の確認結果

このシステムは **arm64 で動きます**。OCI の無料枠で大きいのは Ampere A1（ARM）だけなので、
ここが通るかが本質でした。手元（Apple Silicon）で全コンテナが arm64 で動作し、
LibreOffice 25.2.3.2 も arm64 版が動いています。

実測したリソース使用量:

| | 実測 |
|---|---|
| backend（PDF生成中のピーク） | 124 MiB |
| frontend（開発モード） | 522 MiB ※本番ビルドはより少ない |
| db（MySQL 8.0） | 51 MiB |
| nginx | 1.2 MiB |
| 合計 | **約 700 MiB** |

無料枠は 2 OCPU / 12 GB なので、**6% ほどしか使いません。**

## 詰まるのはリソースではなく在庫

Ampere A1 は「Out of host capacity」で作成できないことが多いです。東京リージョンは
AD が1つしかないため、別ADに逃げることもできません。

空きは断続的に出るので、待つしかありません。

```
./deploy/oci-launch-retry.sh
```

5分間隔で試し続けます。短い間隔で叩くと `Too many requests for the user` で
止められるため、間隔は詰めないこと。

小さめの構成なら通りやすいことがあります。

```
OCPUS=1 MEM=6 ./deploy/oci-launch-retry.sh
```

実測 700 MiB なので、1 OCPU / 6 GB でも十分動きます。

## インスタンスが取れたあと

### 1. ポートを開ける

OCI 側（セキュリティリスト）と OS 側（iptables）の両方を開ける必要があります。
Ubuntu の OCI イメージは既定で iptables が閉じています。**ここを忘れると、
セキュリティリストだけ開けても繋がりません。**

```bash
ssh ubuntu@<IP>
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo netfilter-persistent save
```

### 2. Docker を入れる

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit   # 入り直してグループを反映
```

### 3. 配置して起動

```bash
git clone <このリポジトリ> meal-order-system
cd meal-order-system
cp .env.prod.example .env.prod
vi .env.prod    # 下記を必ず設定
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod exec backend php migrate.php
```

`.env.prod` で必ず設定するもの:

| 項目 | 内容 |
|---|---|
| `PUBLIC_BASE_URL` | `http://<サーバーのIP>`。**フロントのビルド時に焼き込まれる**ので、変えたら `--build` し直す |
| `SECURITY_SALT` | `openssl rand -hex 32` で生成。**未設定だと起動しません** |
| `MYSQL_*` | DBの資格情報 |

## 開発用 compose との違い

`docker-compose.yml` は開発専用で、そのままではサーバーに載りません。

| | 開発用 | Dev/本番用 |
|---|---|---|
| フロント | `npm run dev` | `next build` + `next start` |
| ソース | バインドマウント | イメージに焼く |
| ファイル監視 | ポーリング有効 | なし |
| APIのURL | `http://localhost` 固定 | `PUBLIC_BASE_URL` から |
| CORS | 全開放 | なし（同一オリジン） |

## まだ無いもの

- **HTTPS**。いまは http のみ。Let's Encrypt か OCI のロードバランサ（無料枠 10Mbps）
- バックアップ。MySQL のダンプを定期取得する仕組み
- デプロイの自動化

## 扱うデータについて

**この環境に入れるのは動作確認用のダミーデータだけです。**
入居者の実データを置くには施設側の合意が要ります。

## AI（ローカルLLM）

### なぜ別の機械に置くか

アプリ機は 1GB しかなく、モデルが載りません。Ampere A1 の無料枠
（2OCPU / 12GB）を丸ごとモデルに使い、アプリ機から内部ネットワーク越しに呼びます。

OpenRouter の無料枠は **50回/日**で、毎回ちがうモデルに回されます。
分類用モデル（content-safety）や、中国語で考えて途中でトークンが尽きるモデルに
当たるとそのまま失敗します。献立の材料を 21件作るだけで枠が尽きました。

### 手順

```
# 1. LLM機を取る（空きが出るまで繰り返す）
NAME=meal-order-llm OCPUS=2 MEM=12 bash deploy/oci-launch-retry.sh

# 2. 取れたら、その機械で
APP_IP=<アプリ機の内部IP> bash setup-ollama.sh

# 3. アプリ機の .env を書き換えて再起動
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://<LLM機の内部IP>:11434
OLLAMA_MODEL=qwen2.5:7b-instruct-q4_K_M
```

### 閉じ方

Ollama には**認証がありません**。インターネットに出すと誰でも使える状態になります。
3段で閉じています。

| 段 | やること |
|---|---|
| OCIセキュリティリスト | 11434 を**開けない** |
| iptables | アプリ機の内部IPだけ通す |
| 待ち受け | 内部IPのみ（公開IPでは待たない） |

### 速さの目安

GPUが無いので速くはありません。献立の材料作成は月に一度のまとめ作業なので、
待てる範囲に収まるかを `setup-ollama.sh` の最後で実測します。

遅すぎる場合はモデルを小さくします（`qwen2.5:3b-instruct-q4_K_M`）。
