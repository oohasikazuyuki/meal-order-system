# kamaho（shokusu）との共通DB — 設計メモ

## 結論：新しい共通スキーマは作らない

当初は `shared` スキーマを新設して部屋・入居者・予約を移す案だったが、
kamaho の実テーブル定義を確認した結果、**その必要は無い**と判断した。

kamaho の `shokusu` スキーマが既に唯一の正なので、
そこに**ビューを作って契約面にし、権限で見せる範囲を絞る**だけでよい。
データ移行も二重書き込みも同期処理も発生しない。

```
shokusu（kamaho。テーブルは一切変更しない）
  ├ m_room_info / m_user_info / t_individual_reservation_info …
  └ v_rooms, v_meal_counts_by_room   ← これだけ meal_order に見せる
meal_order_db（このシステム）
  └ rooms を shokusu.v_rooms のビューに差し替え（部屋の追加・削除は廃止）
```

## 実データを見て分かったこと

| 確認前の懸念 | 実際 |
|---|---|
| マルチテナントの軸を通す必要がある | `tenants` / `facilities` はいずれも **0件**。かつ `m_room_info` `m_user_info` `t_individual_reservation_info` に `tenant_id` / `facility_id` 列が**無い**。未配線なので、いまは考慮しない |
| 転室で部屋が変わるため日付解決が要る | `t_individual_reservation_info.i_id_room` が**予約行に部屋を持っている**。その日どの部屋にいたかは記録済みで、`m_room_transfer_schedule` を引く必要は無い |
| 予約が2階層で複雑 | `t_reservation_info` は **0件**。実データ 7,371件はすべて `t_individual_reservation_info` |

将来テナントを実運用に入れるなら、そのときビューに `facility_id` を足して
meal_order 側に列を1つ増やせばよい。いま作り込む理由は無い。

## 前提条件（構成）

両アプリが**同一の MySQL インスタンス**に接続できることが前提。
現在 kamaho はホスト先、meal-order-system は docker で別々なので、
ここを揃えるのがインフラ側の最初の作業になる。

## 確定済みの業務ルール

- **発注は予約ベース。承認状態を問わない。** 発注は前もって出すものなので承認を待たない。
- **実食数は分析で使う。** `i_approval_status` の承認フローは実食数入力のためのもの。

この2つは `v_meal_counts_by_room` の `reserved_count` / `actual_count` として
同じ行に並べる。別ビューに分けると読み違えても数字は返るため気づけない。

### 分析で見たい3つの数

| 数 | どこにある |
|---|---|
| 予約食数 | `shokusu.v_meal_counts_by_room.reserved_count` |
| **発注数** | `meal_order_db.block_order_quantities.order_quantity`（人が調整した数） |
| 実食数 | `shokusu.v_meal_counts_by_room.actual_count` |

真ん中の発注数はこのシステムが持っている。共通DBになれば3つを1クエリで並べられるので、
「予約に対して何食多く発注したか」「発注に対して何食残ったか」が出せる。食材ロスの分析はここ。

## kamaho のソース（kamaho-source/shokusuu1）で確定した仕様

- **食事種別は一致。** 1=朝 2=昼 3=夕 4=弁当。meal_order の `meal_type` と同じ。
- **有効なフラグは日付で切り替わる**（`ReservationDatePolicy`）。
  予約日 <= 今日+14日 → `i_change_flag` / 今日+15日以降 → `eat_flag`。
  **`eat_flag` 固定だと直近2週間の食数が常に誤る。**

### 「実食」は職員だけの概念

各サービスの役割を取り違えないこと。

| クラス | 実際の役割 |
|---|---|
| `ReservationReportService` | **予約**の食数集計（日次・部屋別あり） |
| `ActualMealManagementService` | **実食確認**。職員のみ・朝昼夕のみ |
| `MealSummaryExportService` | **職員別の食費精算**。単価を掛けて金額を出す。部屋別ではない |

根拠:
- `getAdultUsers` が `i_id_staff IS NOT NULL AND != ''` で職員に限定
- `buildWeekGrid` が `i_reservation_type IN (1,2,3)` で弁当を除外
- `MealSummaryExportService::aggregate` は職員ごとに `MMealPriceInfo` の単価を掛ける

つまり **児童の実食記録は kamaho に存在しない**。分析で使えるのは
「予約食数 vs 発注数」の差と、職員分の実食だけ。
ビューの列名を `staff_actual_count` にしているのはこの取り違えを防ぐため。

### 未解決

- `CURDATE()` はDBサーバのタイムゾーン依存。ポリシーは Asia/Tokyo 基準なので揃えること。
- 同一 MySQL インスタンスに載せられるか（構成面）。
