<?php
namespace App\Controller\Api;

use App\Controller\AppController;
use App\Repository\UserRepository;
use App\Service\CredentialCryptoService;
use App\Service\KamahoApiService;
use App\Service\KamahoCredentialResolverService;
use Cake\I18n\FrozenTime;

class RoomsController extends AppController
{
    private UserRepository $userRepository;
    private CredentialCryptoService $credentialCryptoService;
    private KamahoCredentialResolverService $kamahoCredentialResolverService;

    public function initialize(): void
    {
        parent::initialize();
        $this->Rooms = $this->fetchTable('Rooms');
        $this->userRepository = new UserRepository();
        $this->credentialCryptoService = new CredentialCryptoService();
        $this->kamahoCredentialResolverService = new KamahoCredentialResolverService();
    }

    /** GET /api/rooms.json */
    public function index(): void
    {
        $rooms = $this->Rooms->find('all')
            ->orderBy(['sort_order' => 'ASC', 'id' => 'ASC'])
            ->toArray();

        $this->set(['ok' => true, 'rooms' => $rooms]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'rooms']);
    }

    /** POST /api/rooms.json */
    public function add(): void
    {
        $entity = $this->Rooms->newEntity($this->request->getData());

        if ($this->Rooms->save($entity)) {
            $this->response = $this->response->withStatus(201);
            $this->set(['ok' => true, 'room' => $entity]);
        } else {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'errors' => $entity->getErrors()]);
        }
        $this->viewBuilder()->setOption('serialize', ['ok', 'room', 'errors']);
    }

    /** DELETE /api/rooms/:id.json */
    public function delete(int $id): void
    {
        $entity = $this->Rooms->get($id);
        $this->Rooms->delete($entity);

        $this->set(['ok' => true]);
        $this->viewBuilder()->setOption('serialize', ['ok']);
    }

    /**
     * POST /api/rooms/kamaho-login.json
     * kamaho 連携ログインの接続確認
     */
    public function kamahoLogin(): void
    {
        $authUser = $this->requireAuthenticatedUser();
        if ($authUser === null) {
            return;
        }

        $data = $this->request->getData();
        $account = trim((string)($data['account'] ?? $data['login_id'] ?? $data['c_login_account'] ?? ''));
        $password = (string)($data['password'] ?? $data['login_password'] ?? $data['c_login_passwd'] ?? '');

        if ($account === '' || $password === '') {
            $accountB64 = $this->request->getHeaderLine('X-Kamaho-Login-Account-B64');
            $passwordB64 = $this->request->getHeaderLine('X-Kamaho-Login-Password-B64');
            if ($accountB64 !== '' && $passwordB64 !== '') {
                $decodedAccount = base64_decode($accountB64, true);
                $decodedPassword = base64_decode($passwordB64, true);
                if ($decodedAccount !== false && $decodedPassword !== false) {
                    $account = trim($decodedAccount);
                    $password = $decodedPassword;
                }
            }
        }

        if ($account === '' || $password === '') {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'message' => '連携ログインIDと連携パスワードを入力してください']);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
            return;
        }

        try {
            $service = new KamahoApiService([
                'login_account' => $account,
                'login_password' => $password,
            ]);
            $rooms = $service->getRooms();

            $user = $this->userRepository->findById((int)$authUser['id']);
            if ($user) {
                $user->kamaho_login_id = $account;
                $user->kamaho_password_enc = $this->credentialCryptoService->encrypt($password);
                $user->kamaho_linked_at = FrozenTime::now();
                $this->userRepository->save($user);
            }

            $this->set([
                'ok' => true,
                'message' => 'kamaho 連携ログインに成功しました',
                'room_count' => count($rooms),
                'kamaho_login_id' => $account,
            ]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message', 'room_count', 'kamaho_login_id']);
        } catch (\RuntimeException $e) {
            $this->response = $this->response->withStatus(401);
            $this->set(['ok' => false, 'message' => $e->getMessage()]);
            $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
        }
    }

    /**
     * POST /api/rooms/sync-kamaho.json
     * kamaho から部屋名一覧を取得し、未登録の部屋を DB に追加する
     */
    public function syncKamaho(): void
    {
        $user = $this->requireAuthenticatedUser();
        if ($user === null) {
            return;
        }
        $service = $this->buildKamahoServiceFromRequest();
        try {
            $allCounts = $service->getAllRoomsMealCounts();
        } catch (\RuntimeException $e) {
            if ($this->hasKamahoCredentialHeaders()) {
                try {
                    $allCounts = (new KamahoApiService())->getAllRoomsMealCounts();
                } catch (\RuntimeException) {
                    $this->response = $this->response->withStatus(502);
                    $this->set(['ok' => false, 'message' => $e->getMessage()]);
                    $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
                    return;
                }
            } else {
                $this->response = $this->response->withStatus(502);
                $this->set(['ok' => false, 'message' => $e->getMessage()]);
                $this->viewBuilder()->setOption('serialize', ['ok', 'message']);
                return;
            }
        }

        $kamahoNames = array_keys($allCounts);

        $existing = $this->Rooms->find()->select(['name'])->toArray();
        $existingNames = array_map(fn($r) => $r->name, $existing);

        $added = [];
        foreach ($kamahoNames as $i => $name) {
            if (!in_array($name, $existingNames, true)) {
                $entity = $this->Rooms->newEntity(['name' => $name, 'sort_order' => $i]);
                if ($this->Rooms->save($entity)) {
                    $added[] = $name;
                }
            }
        }

        $rooms = $this->Rooms->find('all')->orderBy(['sort_order' => 'ASC', 'id' => 'ASC'])->toArray();
        $this->set(['ok' => true, 'added' => $added, 'rooms' => $rooms, 'kamaho_rooms' => $kamahoNames]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'added', 'rooms', 'kamaho_rooms']);
    }

    private function buildKamahoServiceFromRequest(): KamahoApiService
    {
        $options = $this->kamahoCredentialResolverService->resolveKamahoOptions($this->request);
        return new KamahoApiService($options);
    }

    private function hasKamahoCredentialHeaders(): bool
    {
        if ($this->request->getHeaderLine('X-Kamaho-Login-Account-B64') !== '' && $this->request->getHeaderLine('X-Kamaho-Login-Password-B64') !== '') {
            return true;
        }
        return $this->request->getHeaderLine('X-Kamaho-Login-Account') !== '' && $this->request->getHeaderLine('X-Kamaho-Login-Password') !== '';
    }
}
