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
