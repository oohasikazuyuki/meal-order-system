-- =============================================================================
-- 連携の契約（ビュー）と権限
--
-- kamaho の実テーブルは一切変更しない。ビューだけを追加し、
-- meal-order-system にはビューへの SELECT 権限のみを与える。
--
-- ビューを契約面にしておくと、kamaho 側が実テーブルを作り替えても
-- ビューの形さえ保てば meal-order-system は壊れない。
-- いま HTML の正規表現が担っている役目を、型のついた契約に置き換える。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 部屋マスタ
--   meal_order.rooms はこのビューを参照する形に差し替える。
--   列名を meal_order 側の既存カラム名に合わせてあるので、
--   アプリ側のクエリは変更せずに済む。
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW `shokusu`.`v_rooms` AS
SELECT
    r.i_id_room                    AS `id`,
    r.c_room_name                  AS `name`,
    COALESCE(r.i_disp_no, 0)       AS `sort_order`,
    r.dt_create                    AS `created`,
    r.dt_update                    AS `modified`
FROM `shokusu`.`m_room_info` r
WHERE COALESCE(r.i_del_flg, 0) = 0
  AND COALESCE(r.i_enable, 1) = 1;

-- -----------------------------------------------------------------------------
-- 日付 × 部屋 × 食事種別 → 予約食数 と 職員の実食数
--
-- 根拠: kamaho-source/shokusuu1
--   ReservationDatePolicy / ReservationReportService  … 予約の食数集計
--   ActualMealManagementService / MealSummaryExportService … 実食確認と職員の食費精算
--
-- ■ 食事種別（MealSummaryExportService の定数）
--     1=朝食 2=昼食 3=夕食 4=弁当  … meal_order の meal_type と同じ
--
-- ■ reserved_count（予約食数・発注用）
--   児童・職員をまとめた予約ベースの食数。承認状態は見ない。
--   有効なフラグが日付で変わる（ReservationDatePolicy）:
--     予約日 <= 今日+14日 … 直前編集 → i_change_flag
--     予約日 >= 今日+15日 … 通常予約 → eat_flag
--   ※ eat_flag 固定だと直近2週間が常に誤る。発注画面が扱うのはその範囲。
--   ※ CURDATE() はDBサーバのタイムゾーン依存。ポリシーは Asia/Tokyo 基準なので揃えること。
--
-- ■ staff_actual_count（職員の実食数・精算/分析用）
--   ★「実食」は kamaho では職員だけの概念。児童の実食記録は存在しない。
--     - ActualMealManagementService::getAdultUsers が
--       i_id_staff IS NOT NULL AND != '' で職員のみに限定
--     - buildWeekGrid が i_reservation_type IN (1,2,3) で弁当を除外
--     - MealSummaryExportService が MMealPriceInfo の単価を掛けて金額を出す
--       （職員の食費精算が目的。部屋別の集計ではない）
--   有効フラグの判定は予約用と異なり「i_change_flag があればそちら」。
--   承認は最終承認（i_approval_status = 2）のみ。
--
--   列名に staff_ を付けているのは、これを全体の実食数と取り違えると
--   分析の数字が静かにずれるため。児童を含む実食数は kamaho に無い。
--
-- ■ 部屋
--   予約行の i_id_room をそのまま使う。転室後に過去分を遡って付け替えないため、
--   過去の発注書を再出力しても数字が変わらない。
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW `shokusu`.`v_meal_counts_by_room` AS
SELECT
    ir.d_reservation_date  AS `date`,
    ir.i_id_room           AS `room_id`,
    ir.i_reservation_type  AS `meal_type`,
    SUM(
        CASE
            WHEN ir.d_reservation_date <= CURDATE() + INTERVAL 14 DAY
                THEN COALESCE(ir.i_change_flag, 0)
            ELSE COALESCE(ir.eat_flag, 0)
        END = 1
    ) AS `reserved_count`,
    SUM(
        u.i_id_staff IS NOT NULL AND u.i_id_staff <> ''
        AND ir.i_reservation_type IN (1, 2, 3)
        AND ir.i_approval_status = 2
        AND COALESCE(ir.i_change_flag, ir.eat_flag, 0) = 1
    ) AS `staff_actual_count`
FROM `shokusu`.`t_individual_reservation_info` ir
LEFT JOIN `shokusu`.`m_user_info` u ON u.i_id_user = ir.i_id_user
GROUP BY ir.d_reservation_date, ir.i_id_room, ir.i_reservation_type;

-- =============================================================================
-- 権限
--
-- 「入居者の個人行を見ない」を運用ルールではなく権限で担保する。
-- m_user_info には氏名・性別・年齢に加えてログインパスワードも入っているため、
-- 発注用アカウントからは到達できないようにする。
-- =============================================================================

CREATE USER IF NOT EXISTS 'meal_order'@'%' IDENTIFIED BY '＜要変更＞';
GRANT ALL PRIVILEGES ON `meal_order_db`.*                   TO 'meal_order'@'%';
GRANT SELECT          ON `shokusu`.`v_rooms`                TO 'meal_order'@'%';
GRANT SELECT          ON `shokusu`.`v_meal_counts_by_room`  TO 'meal_order'@'%';
-- m_user_info / t_individual_reservation_info への直接権限は与えない

-- -----------------------------------------------------------------------------
-- meal_order 側：rooms をビューに差し替える
--   blocks に外部キーは無いので、参照制約の張り替えは不要。
--   ただし部屋の追加・削除・kamaho同期（RoomsController の add / delete /
--   syncKamaho）は書き込みになるため廃止する必要がある。
-- -----------------------------------------------------------------------------
-- RENAME TABLE `meal_order_db`.`rooms` TO `meal_order_db`.`rooms_backup_YYYYMMDD`;
-- CREATE OR REPLACE VIEW `meal_order_db`.`rooms` AS
--   SELECT `id`, `name`, `sort_order`, `created`, `modified` FROM `shokusu`.`v_rooms`;
