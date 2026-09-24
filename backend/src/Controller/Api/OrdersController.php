<?php
namespace App\Controller\Api;

use App\Application\Container\ServiceContainer;
use App\Application\DTO\CreateOrderDTO;
use App\Application\DTO\UpdateOrderDTO;
use App\Application\Exception\ApplicationException;
use App\Application\Exception\ErrorCode;
use App\Application\Exception\InputValidationException;
use App\Application\UseCase\CreateOrderUseCase;
use App\Application\UseCase\DeleteOrderUseCase;
use App\Application\UseCase\GetOrderListUseCase;
use App\Application\UseCase\GetOrderSummaryByDateUseCase;
use App\Application\UseCase\UpdateOrderUseCase;
use App\Controller\AppController;
use App\Service\OrderService as LegacyOrderService;
use App\Domain\Exception\DomainException;
use App\Domain\Repository\OrderRepositoryInterface;
use App\Domain\Service\OrderDomainService;
use App\Domain\ValueObject\OrderId;

/**
 * 発注管理API
 * クリーンアーキテクチャー版
 */
class OrdersController extends AppController
{
    private OrderRepositoryInterface $orderRepository;
    private OrderDomainService $orderDomainService;
    private ServiceContainer $container;
    private LegacyOrderService $legacyOrderService;

    public function initialize(): void
    {
        parent::initialize();
        
        // DIコンテナから依存性を解決
        $this->container = ServiceContainer::getInstance();
        $this->orderRepository = $this->container->get(OrderRepositoryInterface::class);
        $this->orderDomainService = new OrderDomainService($this->orderRepository);
        $this->legacyOrderService = new LegacyOrderService();
    }

    /** GET /api/orders - 発注一覧 */
    public function index(): void
    {
        try {
            $this->set([
                'success' => true,
                'orders' => $this->legacyOrderService->getOrderList()
            ]);
            $this->viewBuilder()->setOption('serialize', ['success', 'orders']);
        } catch (\Exception $e) {
            $this->handleError($e, 500);
        }
    }

    /** GET /api/orders/:id - 発注詳細 */
    public function view(int $id): void
    {
        try {
            $order = $this->legacyOrderService->getOrderById($id);
            if (!$order) throw new DomainException('発注が見つかりません', 404);

            $this->set([
                'success' => true,
                'order' => $order
            ]);
            $this->viewBuilder()->setOption('serialize', ['success', 'order']);
        } catch (DomainException $e) {
            $this->handleError($e, (int)$e->getCode());
        } catch (\Exception $e) {
            $this->handleError($e, 500);
        }
    }

    /** POST /api/orders - 発注登録 */
    public function add(): void
    {
        try {
            $dto = new CreateOrderDTO($this->request->getData());
            
            $useCase = new CreateOrderUseCase($this->orderRepository, $this->orderDomainService);
            $order = $useCase->execute($dto);

            $this->response = $this->response->withStatus(201);
            $this->set([
                'success' => true,
                'order' => $order->toArray()
            ]);
            $this->viewBuilder()->setOption('serialize', ['success', 'order']);
        } catch (InputValidationException $e) {
            $this->handleValidationError($e);
        } catch (DomainException $e) {
            $this->handleError($e, (int)$e->getCode());
        } catch (ApplicationException $e) {
            $this->handleError($e, $e->getHttpStatus());
        } catch (\Exception $e) {
            $this->handleError($e, 500);
        }
    }

    /** PUT /api/orders/:id - 発注更新 */
    public function edit(int $id): void
    {
        try {
            $result = $this->legacyOrderService->updateOrder($id, $this->request->getData());
            if (!$result['success']) {
                $this->response = $this->response->withStatus(400);
                $this->set(['success' => false, 'errors' => $result['errors']]);
                $this->viewBuilder()->setOption('serialize', ['success', 'errors']);
                return;
            }
            $this->set(['success' => true, 'order' => $result['entity']]);
            $this->viewBuilder()->setOption('serialize', ['success', 'order']);
        } catch (\Exception $e) {
            $this->handleError($e, 500);
        }
    }

    /** DELETE /api/orders/:id - 発注削除 */
    public function delete(int $id): void
    {
        try {
            $this->legacyOrderService->deleteOrder($id);
            $this->set(['success' => true]);
            $this->viewBuilder()->setOption('serialize', ['success']);
        } catch (\Exception $e) {
            $this->handleError($e, 500);
        }
    }

    /** GET /api/orders/summary - 日別発注サマリー */
    public function summary(): void
    {
        try {
            $date = $this->request->getQuery('date', date('Y-m-d'));

            $this->set([
                'success' => true,
                'orders' => $this->legacyOrderService->getOrderSummaryByDate($date)
            ]);
            $this->viewBuilder()->setOption('serialize', ['success', 'orders']);
        } catch (\InvalidArgumentException $e) {
            $this->handleError($e, 400);
        } catch (\Exception $e) {
            $this->handleError($e, 500);
        }
    }

    /**
     * バリデーションエラー処理
     */
    private function handleValidationError(InputValidationException $e): void
    {
        $statusCode = $e->getHttpStatus() > 0 ? $e->getHttpStatus() : 400;
        $requestId = $this->requestId();
        $this->response = $this->response->withStatus($statusCode);
        $this->set([
            'success' => false,
            'message' => $e->getMessage(),
            'errors' => $e->getErrors(),
            'error' => [
                'code' => $e->getErrorCode(),
                'message' => $e->getMessage(),
                'details' => $e->getErrors(),
                'request_id' => $requestId,
            ],
        ]);
        $this->viewBuilder()->setOption('serialize', ['success', 'message', 'errors', 'error']);
    }

    /**
     * エラーハンドリング
     */
    private function handleError(\Exception $e, int $statusCode): void
    {
        $safeStatusCode = $statusCode > 0 ? $statusCode : 500;
        $requestId = $this->requestId();
        $errorCode = $this->resolveErrorCode($e, $safeStatusCode);
        $this->response = $this->response->withStatus($safeStatusCode);
        $this->set([
            'success' => false,
            'message' => $e->getMessage(),
            'error' => [
                'code' => $errorCode,
                'message' => $e->getMessage(),
                'details' => $e instanceof ApplicationException ? $e->getDetails() : [],
                'request_id' => $requestId,
            ]
        ]);
        $this->viewBuilder()->setOption('serialize', ['success', 'message', 'error']);
    }

    private function resolveErrorCode(\Exception $e, int $statusCode): string
    {
        if ($e instanceof ApplicationException) {
            return $e->getErrorCode();
        }

        if ($e instanceof \InvalidArgumentException) {
            return ErrorCode::ORDER_VALIDATION_DATE;
        }

        if ($e instanceof DomainException) {
            if (str_contains($e->getMessage(), '同じメニューの発注が既に存在')) {
                return ErrorCode::ORDER_DUPLICATE;
            }
            if (str_contains($e->getMessage(), '編集できません')) {
                return ErrorCode::ORDER_STATE_NOT_EDITABLE;
            }
            if ($statusCode === 404) {
                return ErrorCode::COMMON_NOT_FOUND;
            }
        }

        if ($statusCode >= 500) {
            return ErrorCode::COMMON_INTERNAL;
        }
        if ($statusCode === 404) {
            return ErrorCode::COMMON_NOT_FOUND;
        }
        if ($statusCode === 409 || $statusCode === 422) {
            return ErrorCode::COMMON_CONFLICT;
        }

        return ErrorCode::COMMON_VALIDATION;
    }

    private function requestId(): string
    {
        $requestId = trim((string)$this->request->getHeaderLine('X-Request-Id'));
        if ($requestId !== '') {
            return $requestId;
        }

        try {
            return 'req_' . bin2hex(random_bytes(8));
        } catch (\Exception) {
            return 'req_' . str_replace('.', '', (string)microtime(true));
        }
    }
}