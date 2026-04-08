<?php
namespace App\Controller\Api;

use App\Controller\AppController;
use PhpOffice\PhpSpreadsheet\IOFactory;
use DateTime;
use DateTimeZone;

/**
 * 発注書 Excel 生成 API
 *
 * GET  /api/order-sheets/calculate.json?week_start=YYYY-MM-DD  → 食材集計プレビュー（2週分）
 * POST /api/order-sheets/download  { week_start, supplier_id, days } → Excel DL
 * POST /api/order-sheets/pdf       { week_start, supplier_id, days } → PDF
 *
 * days が空または未指定の場合: 今日を起点に今後2週間の納品日を自動計算（過去日は除外）
 * days に値がある場合: フロントの編集内容を使用
 */
class OrderSheetsController extends AppController
{
    public function initialize(): void
    {
        parent::initialize();
        $this->Suppliers = $this->fetchTable('Suppliers');
        $this->Menus = $this->fetchTable('Menus');
        $this->Users = $this->fetchTable('Users');
        $this->Blocks = $this->fetchTable('Blocks');
    }

    /**
     * GET /api/order-sheets/calculate.json?week_start=YYYY-MM-DD
     * 当週 + 翌週の全納品日の食材集計を返す（食材なしの日も空配列で含める）
     */
    public function calculate(): void
    {
        $weekStart = $this->parseWeekStart($this->request->getQuery('week_start'));
        if (!$weekStart) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'week_start (YYYY-MM-DD の月曜日) は必須です']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $week2Start = (clone $weekStart)->modify('+7 days');
        [, , $userBlockId] = $this->getUserContext();
        $today = new DateTime('today');
        // has_order_sheet = 0 の業者（生協など）は発注書と連動しないため除外
        $suppliers  = $this->Suppliers->find()->where(['has_order_sheet' => 1])->toArray();
        $result     = [];

        foreach ($suppliers as $supplier) {
            $deliveryDates = [];
            $orderDay  = $supplier->order_day !== null ? (int)$supplier->order_day : null;
            $leadWeeks = (int)($supplier->delivery_lead_weeks ?? 0);
            $hasPipe   = strpos($supplier->delivery_days, '|') !== false;
            foreach ([$weekStart, $week2Start] as $weekIdx => $wStart) {
                // 翌週納品（leadWeeks）かつ今週分はスキップ（パイプ形式は個別制御）
                if (!$hasPipe && $leadWeeks >= 1 && $weekIdx === 0) continue;
                // パイプ形式："今週days|翌週days" → 週ごとに異なる曜日を使用
                $daysStr = $hasPipe
                    ? $this->getWeekDeliveryDays($supplier->delivery_days, $weekIdx)
                    : $supplier->delivery_days;
                if ($daysStr === '') continue;
                foreach ($this->parseDeliveryEntries($daysStr, $wStart) as $dayOffset => $date) {
                    // パイプ形式では曜日は明示指定済みのためorder_dayフィルタは不要
                    if (!$hasPipe && $weekIdx === 0 && $orderDay !== null && $dayOffset < $orderDay) continue;
                    if ($date < $today) continue;
                    $dateStr = $date->format('Y-m-d');
                    $deliveryDates[$dateStr] = true;
                }
            }

            $dateList = array_keys($deliveryDates);
            sort($dateList);
            $totalsByDate = $this->getIngredientTotalsByDates($dateList, (int)$supplier->id, $userBlockId);
            $days = [];
            foreach ($dateList as $dateStr) {
                $days[$dateStr] = $totalsByDate[$dateStr] ?? [];
            }

            $result[] = [
                'supplier_id'   => $supplier->id,
                'supplier_name' => $supplier->name,
                'days'          => $days,
            ];
        }

        $this->set(['ok' => true, 'week_start' => $weekStart->format('Y-m-d'), 'suppliers' => $result]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'week_start', 'suppliers']);
    }

    /**
     * GET /api/order-sheets/inventory.json?week_start=YYYY-MM-DD
     * 在庫（鎌ホ在庫）から用意する食材の週別一覧を返す
     * 納品日ではなく使用日（menu_date）単位で集計
     */
    public function inventory(): void
    {
        $weekStart = $this->parseWeekStart($this->request->getQuery('week_start'));
        if (!$weekStart) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'week_start は必須です']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        // 在庫業者（code='Z'、has_order_sheet=0）を取得
        $invSupplier = $this->Suppliers->find()->where(['code' => 'Z'])->first();

        if (!$invSupplier) {
            $this->set(['ok' => true, 'week_start' => $weekStart->format('Y-m-d'), 'days' => []]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'week_start', 'days']);
            return;
        }

        $week2Start  = (clone $weekStart)->modify('+7 days');
        $weekEnd     = (clone $weekStart)->modify('+13 days');
        $days        = [];
        [, , $userBlockId] = $this->getUserContext();

        // 2週分の全日付について在庫食材を集計（menu_date単位）
        $conn = $this->Menus->getConnection();
        $blockFilterSql = $userBlockId !== null ? ' AND m.block_id = :block_id' : '';
        $params = [
            'supplier_id' => $invSupplier->id,
            'start'       => $weekStart->format('Y-m-d'),
            'end'         => $weekEnd->format('Y-m-d'),
        ];
        if ($userBlockId !== null) {
            $params['block_id'] = $userBlockId;
        }
        $rows = $conn->execute("
            SELECT
                m.menu_date,
                mi.name   AS ingredient_name,
                mi.unit,
                SUM(mi.amount * COALESCE(boq.order_quantity, 0)) AS total_amount
            FROM menus m
            JOIN menu_masters mm
              ON mm.name = m.name
             AND (mm.block_id = m.block_id OR mm.block_id IS NULL)
            JOIN menu_ingredients mi
              ON mi.menu_master_id = mm.id
             AND mi.supplier_id    = :supplier_id
             AND mi.name          != ''
            LEFT JOIN block_order_quantities boq
              ON boq.order_date = m.menu_date
             AND boq.block_id   = m.block_id
             AND boq.meal_type  = m.meal_type
            WHERE m.menu_date BETWEEN :start AND :end
              {$blockFilterSql}
            GROUP BY m.menu_date, mi.name, mi.unit
            HAVING total_amount > 0
            ORDER BY m.menu_date, mi.name
        ", $params)->fetchAll('assoc');

        // 日付ごとに整理
        foreach ($rows as $r) {
            $dateStr = $r['menu_date'];
            if (!isset($days[$dateStr])) {
                $days[$dateStr] = [];
            }
            $days[$dateStr][] = [
                'name'   => $r['ingredient_name'],
                'amount' => (float)$r['total_amount'],
                'unit'   => $r['unit'],
            ];
        }
        ksort($days);

        $this->set([
            'ok'         => true,
            'week_start' => $weekStart->format('Y-m-d'),
            'days'       => $days,
        ]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'week_start', 'days']);
    }

    /** GET/POST /api/order-sheets/download */
    public function download(): void
    {
        [$supplier, $spreadsheet, $weekStart, $blockName, $userId] = $this->resolveOrderSheet();
        if (!$supplier) return;

        // 監査ログを記録
        $this->logOrderSheetAction($userId, $supplier->id, $weekStart, $blockName, 'download');

        $ext      = $supplier->file_ext;
        $filename = $supplier->name . '_' . $weekStart->format('Y-m-d') . '週.' . $ext;

        $tmpFile = tempnam(sys_get_temp_dir(), 'order_sheet_') . '.xlsx';
        IOFactory::createWriter($spreadsheet, 'Xlsx')->save($tmpFile);
        if ($this->resolveSupplierSheetType($supplier) === 'kawano') {
            $this->sanitizeKawanoXlsx($tmpFile);
        }

        while (ob_get_level() > 0) ob_end_clean();
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename*=UTF-8\'\'' . rawurlencode($filename));
        header('Content-Length: ' . filesize($tmpFile));
        header('Cache-Control: max-age=0, no-store');
        readfile($tmpFile);
        unlink($tmpFile);
        exit;
    }

    /** GET/POST /api/order-sheets/pdf */
    public function pdf(): void
    {
        [$supplier, $spreadsheet, $weekStart, $blockName, $userId] = $this->resolveOrderSheet();
        if (!$supplier) return;

        // 監査ログを記録
        $this->logOrderSheetAction($userId, $supplier->id, $weekStart, $blockName, 'pdf');

        $tmpXlsx = sys_get_temp_dir() . '/order_' . uniqid() . '.xlsx';
        IOFactory::createWriter($spreadsheet, 'Xlsx')->save($tmpXlsx);
        if ($this->resolveSupplierSheetType($supplier) === 'kawano') {
            $this->sanitizeKawanoXlsx($tmpXlsx);
        }

        $outDir = sys_get_temp_dir();
        $cmd    = sprintf(
            'HOME=/tmp libreoffice --headless --convert-to pdf --outdir %s %s 2>&1',
            escapeshellarg($outDir),
            escapeshellarg($tmpXlsx)
        );
        exec($cmd, $cmdOutput, $exitCode);
        @unlink($tmpXlsx);

        $pdfFile = $outDir . '/' . basename($tmpXlsx, '.xlsx') . '.pdf';

        if ($exitCode !== 0 || !file_exists($pdfFile)) {
            $this->response = $this->response->withStatus(500);
            $this->set(['ok' => false, 'message' => 'PDF変換に失敗しました: ' . implode(' ', $cmdOutput)]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        $filename = $supplier->name . '_' . $weekStart->format('Y-m-d') . '週.pdf';

        while (ob_get_level() > 0) ob_end_clean();
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename*=UTF-8\'\'' . rawurlencode($filename));
        header('Content-Length: ' . filesize($pdfFile));
        header('Cache-Control: max-age=0, no-store');
        readfile($pdfFile);
        @unlink($pdfFile);
        exit;
    }

    /**
     * リクエスト（GET/POST）からスプレッドシートを生成して返す
     *
     * POST body: { week_start: string, supplier_id: number, days?: { [dateStr]: {name,amount,unit}[] } }
     *
     * days が空または未指定の場合:
     *   - 指定された week_start を起点に今後2週間の納品日を自動計算
     *   - 過去の納品日は除外
     *   - 食材はDBから取得
     * days に値がある場合:
     *   - フロントの編集内容をそのまま使用
     */
    private function resolveOrderSheet(): array
    {
        $isPost = $this->request->is('post');

        if ($isPost) {
            $weekStartStr = (string)($this->request->getData('week_start') ?? $this->request->getQuery('week_start') ?? '');
            $supplierId   = (int)($this->request->getData('supplier_id') ?? $this->request->getQuery('supplier_id') ?? 0);
        } else {
            $weekStartStr = (string)($this->request->getQuery('week_start') ?? '');
            $supplierId   = (int)($this->request->getQuery('supplier_id') ?? 0);
        }

        $weekStart = $this->parseWeekStart($weekStartStr);
        if (!$weekStart || !$supplierId) {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => 'week_start と supplier_id は必須です']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return [null, null, null, null, null];
        }

        $supplier = $this->Suppliers->find()->where(['id' => $supplierId])->first();
        if (!$supplier) {
            $this->response = $this->response->withStatus(404);
            $this->set(['ok' => false, 'message' => '業者が見つかりません']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return [null, null, null, null, null];
        }

        $orderDay  = $supplier->order_day !== null ? (int)$supplier->order_day : null;
        $leadWeeks = (int)($supplier->delivery_lead_weeks ?? 0);
        [$blockName, $userId, $userBlockId] = $this->getUserContext();

        // フロントの編集内容があるか確認
        $postDays = $isPost ? $this->request->getData('days') : null;

        if (!empty($postDays)) {
            // --- フロントの編集内容を使う ---
            $dataByDay = [];
            foreach ((array)$postDays as $dateStr => $ingredientList) {
                if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$dateStr)) continue;
                $date      = new DateTime($dateStr);
                $dayOffset = (int)$weekStart->diff($date)->format('%r%a');
                $dataByDay[$dayOffset] = [
                    'date'        => $date,
                    'ingredients' => array_map(fn($i) => [
                        'name'   => (string)($i['name']   ?? ''),
                        'amount' => (float) ($i['amount'] ?? 0),
                        'unit'   => (string)($i['unit']   ?? ''),
                    ], array_values((array)$ingredientList)),
                ];
            }
        } else {
            // --- 献立管理データから自動計算 ---
            // 提供された weekStart を起点に2週間の納品日を計算し、過去日を除外する
            $today      = new DateTime('today');
            $week2Start = (clone $weekStart)->modify('+7 days');
            $dataByDay  = [];
            $targetDatesByOffset = [];

            $hasPipe = strpos($supplier->delivery_days, '|') !== false;
            foreach ([$weekStart, $week2Start] as $weekIdx => $wStart) {
                if (!$hasPipe && $leadWeeks >= 1 && $weekIdx === 0) continue;
                $daysStr = $hasPipe
                    ? $this->getWeekDeliveryDays($supplier->delivery_days, $weekIdx)
                    : $supplier->delivery_days;
                if ($daysStr === '') continue;
                foreach ($this->parseDeliveryEntries($daysStr, $wStart) as $dayOffset => $date) {
                    // 過去日はスキップ
                    if ($date < $today) continue;
                    // 第1週：発注日より前の曜日はスキップ（パイプ形式は不要）
                    if (!$hasPipe && $weekIdx === 0 && $orderDay !== null && $dayOffset < $orderDay) continue;

                    $actualOffset             = $weekIdx * 7 + $dayOffset;
                    $dateStr                  = $date->format('Y-m-d');
                    $targetDatesByOffset[$actualOffset] = [
                        'date'        => $date,
                        'date_str'    => $dateStr,
                    ];
                }
            }

            $dateList = array_values(array_unique(array_map(
                fn($d) => (string)$d['date_str'],
                array_values($targetDatesByOffset)
            )));
            sort($dateList);
            $totalsByDate = $this->getIngredientTotalsByDates($dateList, $supplierId, $userBlockId);

            foreach ($targetDatesByOffset as $actualOffset => $target) {
                $dateStr = (string)$target['date_str'];
                $dataByDay[$actualOffset] = [
                    'date'        => $target['date'],
                    'ingredients' => $totalsByDate[$dateStr] ?? [],
                ];
            }
        }

        $sheetType = $this->resolveSupplierSheetType($supplier);
        $templateDir  = dirname(APP) . '/resources/excel_templates/';
        $uploadedDir  = dirname(APP) . '/resources/uploaded_templates/';
        $templateMap  = [
            'sakana' => 'sakana_template.xlsx',
            'yaoki'  => 'yaoki_template.xlsx',
            'kawano' => 'kawano_template.xlsm',
        ];

        // アップロード済みテンプレートを優先使用し、なければデフォルトへフォールバック
        $uploadedFile = $uploadedDir . $supplier->id . '.' . $supplier->file_ext;
        $templateFile = file_exists($uploadedFile)
            ? $uploadedFile
            : $templateDir . ($templateMap[$sheetType] ?? '');

        if (!file_exists($templateFile)) {
            $this->response = $this->response->withStatus(404);
            $this->set(['ok' => false, 'message' => 'テンプレートファイルが見つかりません']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return [null, null, null, null, null];
        }

        $spreadsheet = IOFactory::load($templateFile);
        $sheet       = $spreadsheet->getActiveSheet();

        match ($sheetType) {
            'sakana' => $this->fillSakana($sheet, $dataByDay, $weekStart, $blockName, $orderDay),
            'yaoki'  => $this->fillYaoki($sheet, $dataByDay, $weekStart, $blockName, $orderDay),
            'kawano' => $this->fillKawano($sheet, $dataByDay, $weekStart, $blockName, $orderDay),
        };

        return [$supplier, $spreadsheet, $weekStart, $blockName, $userId];
    }

    // ----------------------------------------
    // 食材合計計算（共通）
    // ----------------------------------------
    private function getIngredientTotals(string $date, int $supplierId, ?int $blockId = null): array
    {
        $all = $this->getIngredientTotalsByDates([$date], $supplierId, $blockId);
        return $all[$date] ?? [];
    }

    private function resolveSupplierSheetType($supplier): string
    {
        $code = strtoupper((string)($supplier->code ?? ''));
        $name = (string)($supplier->name ?? '');
        $id   = (int)($supplier->id ?? 0);

        // code を最優先（ID順に依存しない）
        if ($code === 'F') return 'sakana';
        if ($code === 'Y') return 'yaoki';
        if ($code === 'M') return 'kawano';

        // 名称フォールバック
        if (mb_strpos($name, '八百') !== false) return 'yaoki';
        if (
            mb_strpos($name, '河野') !== false
            || mb_strpos($name, '牛豚') !== false
            || mb_strpos($name, '肉') !== false
        ) {
            return 'kawano';
        }

        // 既存データ互換（最終フォールバック）
        return match ($id) {
            1 => 'sakana',
            2 => 'yaoki',
            3 => 'kawano',
            default => 'sakana',
        };
    }

    private function getIngredientTotalsByDates(array $dates, int $supplierId, ?int $blockId = null): array
    {
        if (empty($dates)) {
            return [];
        }

        $datePlaceholders = [];
        $params = ['supplier_id' => $supplierId];
        foreach (array_values($dates) as $i => $date) {
            $key = "d{$i}";
            $datePlaceholders[] = ':' . $key;
            $params[$key] = $date;
        }

        $conn = $this->Menus->getConnection();
        $blockFilterSql = $blockId !== null ? ' AND m.block_id = :block_id' : '';
        if ($blockId !== null) {
            $params['block_id'] = $blockId;
        }

        $inClause = implode(',', $datePlaceholders);
        $rows = $conn->execute("
            SELECT
                m.menu_date,
                mi.name  AS ingredient_name,
                mi.unit,
                mi.persons_per_unit,
                CASE
                    WHEN mi.persons_per_unit IS NOT NULL AND mi.persons_per_unit > 0
                    THEN CEIL(SUM(COALESCE(boq.order_quantity, 0)) / mi.persons_per_unit)
                    ELSE SUM(mi.amount * COALESCE(boq.order_quantity, 0))
                END AS total_amount
            FROM menus m
            JOIN menu_masters mm
              ON mm.name = m.name
             AND (mm.block_id = m.block_id OR mm.block_id IS NULL)
            JOIN menu_ingredients mi
              ON mi.menu_master_id = mm.id
             AND mi.supplier_id    = :supplier_id
             AND mi.name          != ''
            LEFT JOIN block_order_quantities boq
             ON boq.order_date = m.menu_date
             AND boq.block_id   = m.block_id
             AND boq.meal_type  = m.meal_type
            WHERE m.menu_date IN ({$inClause})
              {$blockFilterSql}
            GROUP BY m.menu_date, mi.name, mi.unit, mi.persons_per_unit
            HAVING total_amount > 0
            ORDER BY m.menu_date, mi.name
        ", $params)->fetchAll('assoc');

        $result = [];
        foreach ($dates as $date) {
            $result[$date] = [];
        }
        foreach ($rows as $r) {
            $dateStr = (string)$r['menu_date'];
            if (!isset($result[$dateStr])) {
                $result[$dateStr] = [];
            }
            $result[$dateStr][] = [
                'name'   => $r['ingredient_name'],
                'amount' => (float)$r['total_amount'],
                'unit'   => $r['unit'],
            ];
        }

        return $result;
    }

    // ----------------------------------------
    // 魚丹テンプレート書き込み
    //
    // テンプレートには5週ブロック（月の第1〜5週）がある。
    // 各納品日の「月内の週番号」= ceil(日付/7) でブロックを決定。
    // これにより月をまたぐ場合でも正しいブロックに書き込める。
    // ----------------------------------------
    private function fillSakana($sheet, array $dataByDay, DateTime $weekStart, string $blockName, ?int $orderDay = null): void
    {
        // A4縦・FitToPage（テンプレート設定を継承）
        $sheet->getPageSetup()->setFitToPage(true)->setFitToWidth(1)->setFitToHeight(1);

        // A1: 発注書タイトル（固定）
        $sheet->getCell('A1')->setValue("【 発 注 書 】");

        // E3: 施設名とブロック名を改行で表示（テンプレートのフォーマットに従う）
        if ($blockName !== '') {
            $sheet->getCell('E3')->setValue("鎌 倉 児 童 ホ ー ム\n（ {$blockName}　）");
        } else {
            // ブロック名が取得できない場合はテンプレートのまま
            $sheet->getCell('E3')->setValue("鎌 倉 児 童 ホ ー ム\n（ ブロック名　）");
        }
        $sheet->getStyle('E3')->getAlignment()
            ->setWrapText(true)
            ->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_RIGHT)
            ->setVertical(\PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER);

        // B4: 発注日（order_day 指定時は今日基準の週の指定曜日、未指定は今日）
        $orderDate = $this->calcOrderDate($orderDay, $weekStart);
        $this->writeDateCell($sheet, 'B4', $orderDate);

        // 全5週ブロック定義: [水の日付セル, 金の日付セル, データ開始行]
        $allBlocks = [
            1 => ['A6',  'E6',  8],
            2 => ['A15', 'E15', 17],
            3 => ['A24', 'E24', 26],
            4 => ['A33', 'E33', 35],
            5 => ['A42', 'E42', 44],
        ];

        // 全ブロックをクリア（B4が文字列になったため数式が#VALUE!になるのを防ぐ）
        foreach ($allBlocks as [$wc, $fc, $sr]) {
            $sheet->getCell($wc)->setValue('');
            $sheet->getCell($fc)->setValue('');
            for ($i = 0; $i < 3; $i++) {
                $row = $sr + $i * 2;
                $sheet->getCell('A' . $row)->setValue('');
                $sheet->getCell('C' . $row)->setValue('');
                $sheet->getCell('E' . $row)->setValue('');
                $sheet->getCell('F' . $row)->setValue('');
            }
        }

        // 各納品日の「月内の週番号」= ceil(日付/7) でブロックを決定
        // 水曜(N=3)→左列(A/C)、金曜(N=5)→右列(E/F)
        $blockData = [];
        foreach ($dataByDay as $offset => $data) {
            $date = $data['date'];
            $dow  = (int)$date->format('N'); // 1=Mon..7=Sun
            if (!in_array($dow, [3, 5])) continue; // 水・金のみ

            $dayOfMonth = (int)$date->format('j');
            $blockNum   = max(1, min(5, (int)ceil($dayOfMonth / 7)));

            if ($dow === 3) {
                $blockData[$blockNum]['wed'] = $data;
            } else {
                $blockData[$blockNum]['fri'] = $data;
            }
        }

        // ブロックに書き込む
        foreach ($blockData as $blockNum => $dayParts) {
            [$wedCell, $friCell, $startRow] = $allBlocks[$blockNum];

            if (isset($dayParts['wed'])) {
                $this->writeDateCell($sheet, $wedCell, $dayParts['wed']['date']);
                foreach (array_slice($dayParts['wed']['ingredients'], 0, 3) as $i => $item) {
                    $row = $startRow + $i * 2;
                    $sheet->getCell('A' . $row)->setValue($item['name']);
                    $sheet->getCell('C' . $row)->setValue($this->fmtQty($item));
                }
            }

            if (isset($dayParts['fri'])) {
                $this->writeDateCell($sheet, $friCell, $dayParts['fri']['date']);
                foreach (array_slice($dayParts['fri']['ingredients'], 0, 3) as $i => $item) {
                    $row = $startRow + $i * 2;
                    $sheet->getCell('E' . $row)->setValue($item['name']);
                    $sheet->getCell('F' . $row)->setValue($this->fmtQty($item));
                }
            }
        }
    }

    // ----------------------------------------
    // 八百喜テンプレート書き込み
    // 金(4)・土(5)・月(0)・火(1)・木(3) の5日構成
    // dataByDay のキー（週オフセット）ではなく日付の曜日でマッチングすることで
    // 翌週データ（オフセット7+）も正しく連動する
    // ----------------------------------------
    private function fillYaoki($sheet, array $dataByDay, DateTime $weekStart, string $blockName, ?int $orderDay = null): void
    {
        // A3横・スケール100%（コンテンツ幅1069ptがA3横1160pt内に収まる）
        $sheet->getPageSetup()
            ->setFitToPage(false)
            ->setPaperSize(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::PAPERSIZE_A3)
            ->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE)
            ->setScale(100);

        // E1: 発注書タイトルにブロック名を入れる
        $title = $blockName !== '' ? "【 発 注 書 : {$blockName} 】" : "【 発 注 書 】";
        $sheet->getCell('E1')->setValue($title);

        // N6: テンプレートの鎌倉児童ホームをそのまま使用（ブロック名はタイトルに入れる）

        // C3: 発注日（order_day 指定時は今日基準の週の指定曜日、未指定は今日）
        $orderDate = $this->calcOrderDate($orderDay, $weekStart);
        $this->writeDateCell($sheet, 'C3', $orderDate);

        // テンプレート列定義: key = 曜日オフセット（0=月..6=日）
        $colsByDow = [
            4 => ['dateCell' => 'B9', 'nameCol' => 'A', 'qtyCol' => 'C', 'unitCol' => 'D'],  // 金
            5 => ['dateCell' => 'E9', 'nameCol' => 'E', 'qtyCol' => 'F', 'unitCol' => 'G'],  // 土
            0 => ['dateCell' => 'H9', 'nameCol' => 'H', 'qtyCol' => 'I', 'unitCol' => 'J'],  // 月
            1 => ['dateCell' => 'K9', 'nameCol' => 'K', 'qtyCol' => 'L', 'unitCol' => 'M'],  // 火
            3 => ['dateCell' => 'N9', 'nameCol' => 'N', 'qtyCol' => 'O', 'unitCol' => 'P'],  // 木
        ];
        $startRow = 11;
        $maxRows  = 12;

        // 全列をクリア
        foreach ($colsByDow as $col) {
            $sheet->getCell($col['dateCell'])->setValue('');
            for ($r = $startRow; $r < $startRow + $maxRows; $r++) {
                $sheet->getCell($col['nameCol'] . $r)->setValue('');
                $sheet->getCell($col['qtyCol']  . $r)->setValue('');
                $sheet->getCell($col['unitCol'] . $r)->setValue('');
            }
        }

        // 曜日でマッチング（week1/week2どちらでも正しく連動）
        foreach ($dataByDay as $data) {
            $dow = (int)$data['date']->format('N') - 1;  // ISO 1=月 → 0, ..., 7=日 → 6
            if (!isset($colsByDow[$dow])) continue;
            $col = $colsByDow[$dow];

            $this->writeDateCell($sheet, $col['dateCell'], $data['date']);
            foreach (array_slice($data['ingredients'], 0, $maxRows) as $i => $item) {
                $row = $startRow + $i;
                $sheet->getCell($col['nameCol'] . $row)->setValue($item['name']);
                $sheet->getCell($col['qtyCol']  . $row)->setValue($item['amount']);
                $sheet->getCell($col['unitCol'] . $row)->setValue($item['unit']);
            }
        }
    }

    // ----------------------------------------
    // 河野テンプレート書き込み
    // 金(4)・月(0)・火(1)・木(3) の4日構成
    // dataByDay のキー（週オフセット）ではなく日付の曜日でマッチングすることで
    // 翌週データ（オフセット7+）も正しく連動する
    // ----------------------------------------
    private function fillKawano($sheet, array $dataByDay, DateTime $weekStart, string $blockName, ?int $orderDay = null): void
    {
        // LibreOffice PDF変換で2ページ化するのを防止:
        // K-N列（テンプレートの入力ガイド等）をクリアしてシート幅を縮小し、
        // FitToWidth(1) で幅のみフィットさせる（FitToHeight は制約なし）
        $sheet->getSheetView()->setView('normal');
        // テンプレート右側（L列付近）にある図形を確実に除去
        $drawings = $sheet->getDrawingCollection();
        for ($i = count($drawings) - 1; $i >= 0; $i--) {
            $drawings[$i]->setWorksheet(null);
        }
        // A1:J28 以外のテンプレート領域を削除
        $sheet->removeColumn('K', 4); // K:N
        $sheet->removeRow(29, 23);    // 29:51
        $sheet->getPageSetup()
            ->setRowsToRepeatAtTop([])
            ->setPrintArea('A1:J28')
            ->setFitToPage(true)
            ->setFitToWidth(1)
            ->setFitToHeight(0);
        $sheet->getPageMargins()
            ->setLeft(0.2)
            ->setRight(0.2);
        $sheet->getPageSetup()
            ->setHorizontalCentered(true);

        // A1: 発注書タイトルにブロック名を入れる（テンプレートのナザレシオン固定値を上書き）
        $title = $blockName !== '' ? "【 発注書： {$blockName} 】" : "【 発注書 】";
        $sheet->getCell('A1')->setValue($title);

        // I6: 施設名のみ（ブロック名はタイトルに入れるためここには不要）
        $sheet->getCell('I6')->setValue('鎌倉児童ホーム');

        // D3: 発注日（「M月D日(曜)」形式）
        $orderDate = $this->calcOrderDate($orderDay, $weekStart);
        $this->writeDateCell($sheet, 'D3', $orderDate);

        // テンプレート列定義: key = 曜日オフセット（0=月..6=日）
        $colsByDow = [
            4 => ['dateCell' => 'B10', 'nameCol' => 'A', 'qtyCol' => 'D'],  // 金
            0 => ['dateCell' => 'E10', 'nameCol' => 'E', 'qtyCol' => 'F'],  // 月
            1 => ['dateCell' => 'G10', 'nameCol' => 'G', 'qtyCol' => 'H'],  // 火
            3 => ['dateCell' => 'I10', 'nameCol' => 'I', 'qtyCol' => 'J'],  // 木
        ];
        $startRow = 13;
        $rowStep  = 2;
        $maxItems = 8;
        $fixedRowHeight = 37.0;

        // ヘッダ行もテンプレート高を固定（PDF変換時の自動行拡張を抑止）
        $sheet->getRowDimension(1)->setRowHeight(46.5);
        $sheet->getRowDimension(3)->setRowHeight(33.75);
        $sheet->getRowDimension(6)->setRowHeight(21.0);
        $sheet->getRowDimension(10)->setRowHeight(27.0);
        $sheet->getRowDimension(28)->setRowHeight(37.0);

        // タイトル/日付/施設名は1行固定で表示
        foreach (['A1', 'D3', 'I6', 'B10', 'E10', 'G10', 'I10'] as $addr) {
            $sheet->getStyle($addr)->getAlignment()
                ->setWrapText(false)
                ->setShrinkToFit(true)
                ->setVertical(\PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER);
        }

        // 行高と表示設定を固定（LibreOffice変換時の自動拡張を防ぐ）
        for ($i = 0; $i < $maxItems; $i++) {
            $row = $startRow + $i * $rowStep;
            $sheet->getRowDimension($row)->setRowHeight($fixedRowHeight);
        }

        // 全列をクリア
        foreach ($colsByDow as $col) {
            $sheet->getCell($col['dateCell'])->setValue('');
            for ($i = 0; $i < $maxItems; $i++) {
                $row = $startRow + $i * $rowStep;
                $sheet->getCell($col['nameCol'] . $row)->setValue('');
                $sheet->getCell($col['qtyCol']  . $row)->setValue('');
                $sheet->getStyle($col['nameCol'] . $row)->getAlignment()
                    ->setWrapText(false)
                    ->setShrinkToFit(true)
                    ->setVertical(\PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER);
                $sheet->getStyle($col['qtyCol'] . $row)->getAlignment()
                    ->setWrapText(false)
                    ->setShrinkToFit(true)
                    ->setVertical(\PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER);
            }
        }

        // 曜日でマッチング（week1/week2どちらでも正しく連動）
        foreach ($dataByDay as $data) {
            $dow = (int)$data['date']->format('N') - 1;  // ISO 1=月 → 0, ..., 7=日 → 6
            if (!isset($colsByDow[$dow])) continue;
            $col = $colsByDow[$dow];

            $this->writeDateCellDateOnly($sheet, $col['dateCell'], $data['date']);
            foreach (array_slice($data['ingredients'], 0, $maxItems) as $i => $item) {
                $row = $startRow + $i * $rowStep;
                $name = preg_replace('/\s+/u', ' ', (string)($item['name'] ?? ''));
                $sheet->getCell($col['nameCol'] . $row)->setValue(trim((string)$name));
                $sheet->getCell($col['qtyCol']  . $row)->setValue($this->fmtQty($item));
            }
        }
    }

    /**
     * kawano テンプレート由来の図形パーツを XLSX から物理除去する。
     * PhpSpreadsheet はテキストボックスを DrawingCollection に展開しないため、
     * 保存後ZIPを直接編集して drawing 参照を削除する。
     */
    private function sanitizeKawanoXlsx(string $xlsxPath): void
    {
        $zip = new \ZipArchive();
        if ($zip->open($xlsxPath) !== true) {
            return;
        }

        $sheetPath = 'xl/worksheets/sheet1.xml';
        $relsPath = 'xl/worksheets/_rels/sheet1.xml.rels';
        $typesPath = '[Content_Types].xml';

        $sheetXml = $zip->getFromName($sheetPath);
        $relsXml = $zip->getFromName($relsPath);
        $typesXml = $zip->getFromName($typesPath);
        if ($sheetXml === false || $relsXml === false || $typesXml === false) {
            $zip->close();
            return;
        }

        // sheet1 上の drawing タグを除去
        $sheetXml = preg_replace('/<drawing\\b[^>]*\\/>/u', '', $sheetXml);
        $sheetXml = preg_replace('/<legacyDrawing\\b[^>]*\\/>/u', '', $sheetXml);
        $sheetXml = preg_replace('/<legacyDrawingHF\\b[^>]*\\/>/u', '', $sheetXml);
        $zip->addFromString($sheetPath, $sheetXml);

        // drawing 用 Relationship を除去し、対象パーツのTargetを回収
        $targets = [];
        if (preg_match_all('/<Relationship\\b[^>]*Type=\"[^\"]*\\/drawing\"[^>]*Target=\"([^\"]+)\"[^>]*\\/>/u', $relsXml, $m)) {
            $targets = $m[1];
        }
        $relsXml = preg_replace('/<Relationship\\b[^>]*Type=\"[^\"]*\\/drawing\"[^>]*\\/>/u', '', $relsXml);
        $zip->addFromString($relsPath, $relsXml);

        foreach ($targets as $target) {
            $targetNorm = ltrim(str_replace('\\', '/', (string)$target), '/');
            if (str_starts_with($targetNorm, '../')) {
                $part = 'xl/' . substr($targetNorm, 3);
            } else {
                $part = 'xl/worksheets/' . $targetNorm;
            }
            $zip->deleteName($part);
            $zip->deleteName(dirname($part) . '/_rels/' . basename($part) . '.rels');

            $partName = '/' . $part;
            $escaped = preg_quote($partName, '/');
            $typesXml = preg_replace('/<Override\\b[^>]*PartName=\"' . $escaped . '\"[^>]*\\/>/u', '', $typesXml);
        }

        // 念のため drawing パーツを全除去（orphan残り対策）
        for ($i = $zip->numFiles - 1; $i >= 0; $i--) {
            $name = $zip->getNameIndex($i);
            if (is_string($name) && str_starts_with($name, 'xl/drawings/')) {
                $zip->deleteName($name);
            }
        }
        $typesXml = preg_replace('/<Override\\b[^>]*PartName=\"\\/xl\\/drawings\\/[^\\\"]+\"[^>]*\\/>/u', '', $typesXml);

        $zip->addFromString($typesPath, $typesXml);
        $zip->close();
    }

    // ----------------------------------------
    // ユーティリティ
    // ----------------------------------------

    private function getUserContext(): array
    {
        try {
            $header = $this->request->getHeaderLine('Authorization');
            
            if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
                error_log("getUserContext: No Bearer token found");
                return ['', null, null];
            }
            
            $token = $m[1];
            
            $user = $this->Users->find()->where(['api_token' => $token])->first();
                
            if (!$user) {
                error_log("getUserContext: User not found for token");
                return ['', null, null];
            }
            
            $userId = $user->id;
            $blockId = $user->block_id !== null ? (int)$user->block_id : null;
            
            if (!$user->block_id) {
                error_log("getUserContext: User ID {$userId} has no block_id");
                return ['', $userId, null];
            }
            
            $block = $this->Blocks->find()->where(['id' => $user->block_id])->first();
                
            $blockName = $block ? str_replace('ブロック', '', (string)$block->name) : '';
            
            return [$blockName, $userId, $blockId];
        } catch (\Throwable $e) {
            error_log("getUserContext: Exception - " . $e->getMessage());
            return ['', null, null];
        }
    }

    private function logOrderSheetAction(?int $userId, int $supplierId, DateTime $weekStart, string $blockName, string $action): void
    {
        try {
            $conn = $this->Suppliers->getConnection();
            $ipAddress = $this->request->clientIp();
            
            $conn->insert('order_sheet_logs', [
                'user_id' => $userId,
                'supplier_id' => $supplierId,
                'week_start' => $weekStart->format('Y-m-d'),
                'block_name' => $blockName ?: null,
                'action' => $action,
                'ip_address' => $ipAddress,
                'created' => date('Y-m-d H:i:s'),
            ]);
            
            error_log("Order sheet {$action}: user_id={$userId}, supplier_id={$supplierId}, block={$blockName}, week={$weekStart->format('Y-m-d')}");
        } catch (\Throwable $e) {
            error_log("Failed to log order sheet action: " . $e->getMessage());
        }
    }

    /**
     * delivery_days 文字列を解析し、当週に該当する [dayOffset => DateTime] を返す
     * dayOffset は 0=月 〜 6=日（weekStart からの日数）
     * フォーマット: "D" または "N:D"（第N週の D 曜日のみ）
     */
    private function parseDeliveryEntries(string $deliveryDays, DateTime $weekStart): array
    {
        $result = [];
        foreach (explode(',', $deliveryDays) as $entry) {
            $entry = trim($entry);
            if ($entry === '') continue;

            if (strpos($entry, ':') !== false) {
                [$weekNum, $dayOffset] = array_map('intval', explode(':', $entry, 2));
            } else {
                $weekNum   = 0;
                $dayOffset = (int)$entry;
            }

            $date = clone $weekStart;
            $date->modify("+{$dayOffset} days");

            if ($weekNum === 0) {
                $result[$dayOffset] = $date;
            } else {
                $dayOfMonth    = (int)$date->format('j');
                $actualWeekNum = (int)ceil($dayOfMonth / 7);
                if ($actualWeekNum === $weekNum) {
                    $result[$dayOffset] = $date;
                }
            }
        }
        return $result;
    }

    private function parseWeekStart(?string $str): ?DateTime
    {
        if (!$str || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $str)) return null;
        $d = DateTime::createFromFormat('!Y-m-d', $str, new DateTimeZone(date_default_timezone_get()));
        if (!$d) return null;
        $dow = (int)$d->format('N');
        if ($dow !== 1) $d->modify('-' . ($dow - 1) . ' days');
        return $d;
    }

    /**
     * パイプ区切り形式 "今週days|翌週days" から週インデックスに対応する部分を返す
     * パイプがない場合はそのまま返す
     */
    private function getWeekDeliveryDays(string $deliveryDays, int $weekIdx): string
    {
        if (strpos($deliveryDays, '|') === false) {
            return $deliveryDays;
        }
        $parts = explode('|', $deliveryDays, 2);
        return trim($weekIdx === 0 ? $parts[0] : $parts[1]);
    }

    /**
     * 発注日を計算する
     * weekStart が指定されている場合はその週の指定曜日を返す
     * weekStart が未指定の場合は従来どおり今日基準で計算する
     */
    private function calcOrderDate(?int $orderDay, ?DateTime $weekStart = null): DateTime
    {
        if ($weekStart !== null) {
            if ($orderDay === null) {
                return clone $weekStart;
            }
            return (clone $weekStart)->modify("+{$orderDay} days");
        }

        $today = new DateTime('today');
        if ($orderDay === null) return $today;
        $dow           = (int)$today->format('N') - 1; // 0=月, ..., 6=日
        $mondayOfToday = (clone $today)->modify('-' . $dow . ' days');
        return $mondayOfToday->modify("+{$orderDay} days");
    }

    /** セルに「M月D日(曜)」形式の日付文字列を書き込む */
    private function writeDateCell($sheet, string $cell, DateTime $date): void
    {
        $dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        $dayName  = $dayNames[(int)$date->format('w')];
        $text     = (int)$date->format('n') . '月' . (int)$date->format('j') . '日(' . $dayName . ')';
        $sheet->getCell($cell)->setValue($text);
    }

    /** セルに「M月D日」形式の日付文字列を書き込む */
    private function writeDateCellDateOnly($sheet, string $cell, DateTime $date): void
    {
        $text = (int)$date->format('n') . '月' . (int)$date->format('j') . '日';
        $sheet->getCell($cell)->setValue($text);
    }

    private function fmtQty(array $item): string
    {
        $amount = ($item['amount'] == (int)$item['amount'])
            ? (int)$item['amount']
            : $item['amount'];
        return $amount . $item['unit'];
    }
}
