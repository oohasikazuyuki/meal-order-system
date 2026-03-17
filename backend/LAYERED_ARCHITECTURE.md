# レイヤードアーキテクチャー

このプロジェクトでは、以下のレイヤードアーキテクチャーを採用しています。

## アーキテクチャー概要

```
┌─────────────────────────────────────┐
│         Controller Layer            │  HTTPリクエスト/レスポンス処理
│  (src/Controller/Api/*.php)         │  入力検証、レスポンス整形
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│          Service Layer              │  ビジネスロジック
│  (src/Service/*.php)                │  トランザクション管理
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│        Repository Layer             │  データアクセス
│  (src/Repository/*.php)             │  クエリ構築、CRUD操作
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│          Model Layer                │  データ構造、バリデーション
│  (src/Model/Table/*.php)            │  リレーション定義
│  (src/Model/Entity/*.php)           │
└─────────────────────────────────────┘
```

## 各層の責務

### Controller層 (src/Controller/Api/)
- HTTPリクエストの受け取り
- リクエストパラメータの取得
- Serviceの呼び出し
- レスポンスの整形と返却
- HTTPステータスコードの設定

**原則**: コントローラーにビジネスロジックを書かない

### Service層 (src/Service/)
- ビジネスロジックの実装
- トランザクション管理
- 複数のRepositoryの協調
- ドメインルールの適用
- エラーハンドリング

**原則**: 再利用可能なビジネスロジックを実装

### Repository層 (src/Repository/)
- データベースアクセスの抽象化
- クエリの構築と実行
- CRUD操作の実装
- データの取得・保存・削除

**原則**: データアクセスロジックのみを実装

### Model層 (src/Model/)
- データ構造の定義
- バリデーションルール
- テーブル間のリレーション定義
- エンティティのプロパティ定義

## 実装例

### 1. OrdersController (Controller層)
```php
class OrdersController extends AppController
{
    private OrderService $orderService;

    public function index(): void
    {
        $orders = $this->orderService->getOrderList();
        $this->set(compact('orders'));
    }
}
```

### 2. OrderService (Service層)
```php
class OrderService
{
    private OrderRepository $orderRepository;

    public function getOrderList(): array
    {
        return $this->orderRepository->findAll([...]);
    }
}
```

### 3. OrderRepository (Repository層)
```php
class OrderRepository
{
    private OrdersTable $Orders;

    public function findAll(array $conditions = []): array
    {
        return $this->Orders->find('all')
            ->where($conditions)
            ->toList();
    }
}
```

## 実装済みコンポーネント

### Controllers
- ✅ OrdersController
- ✅ AuthController
- ✅ UsersController
- ✅ MenusController

### Services
- ✅ OrderService
- ✅ AuthService
- ✅ UserService
- ✅ MenuService

### Repositories
- ✅ OrderRepository
- ✅ UserRepository
- ✅ MenuRepository

## 今後の実装予定

### 未実装コントローラー
- [ ] SuppliersController
- [ ] BlocksController
- [ ] RoomsController
- [ ] MenuMastersController
- [ ] MenuIngredientsController
- [ ] OrderQuantitiesController
- [ ] BlockOrderQuantitiesController
- [ ] OrderSheetsController
- [ ] MenuTableController
- [ ] CoopOrdersController
- [ ] OrderSheetLogsController
- [ ] RoomGramSettingsController
- [ ] KamahoMealCountsController

## 命名規則

### Service
- クラス名: `{Entity}Service` (例: `OrderService`)
- メソッド名: 
  - 取得: `get{Entity}`, `get{Entity}List`
  - 作成: `create{Entity}`
  - 更新: `update{Entity}`
  - 削除: `delete{Entity}`

### Repository
- クラス名: `{Entity}Repository` (例: `OrderRepository`)
- メソッド名:
  - 検索: `findBy{Condition}`
  - 取得: `get`, `findAll`
  - 保存: `save`
  - 削除: `delete`
  - 作成: `create`
  - 更新: `patch`

## メリット

1. **保守性の向上**: 各層の責務が明確
2. **テスト容易性**: 各層を独立してテスト可能
3. **再利用性**: Serviceは複数のControllerから利用可能
4. **変更容易性**: データアクセス層の変更がビジネスロジックに影響しない
5. **可読性**: コードの意図が明確

## ディレクトリ構造

```
backend/src/
├── Controller/
│   └── Api/          # APIコントローラー
├── Service/          # ビジネスロジック
├── Repository/       # データアクセス層
└── Model/
    ├── Table/        # テーブルクラス
    └── Entity/       # エンティティクラス
```
