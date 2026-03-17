<?php
namespace App\Controller\Api;

use App\Controller\AppController;

/**
 * 仕入先マスタ API
 * GET    /api/suppliers.json
 * POST   /api/suppliers.json
 * PUT    /api/suppliers/:id.json
 * DELETE /api/suppliers/:id.json
 */
class SuppliersController extends AppController
{
    public function initialize(): void
    {
        parent::initialize();
        $this->Suppliers = $this->fetchTable('Suppliers');
    }

    public function index(): void
    {
        $suppliers = $this->Suppliers->find()
            ->orderBy(['id' => 'ASC'])
            ->toArray();

        $this->set(['ok' => true, 'suppliers' => $suppliers]);
        $this->viewBuilder()->setOption('serialize', ['ok', 'suppliers']);
    }

    public function add(): void
    {
        $data     = $this->request->getData();
        $supplier = $this->Suppliers->newEntity($data);

        if ($this->Suppliers->save($supplier)) {
            $this->response = $this->response->withStatus(201);
            $this->set(['ok' => true, 'supplier' => $supplier]);
        } else {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'errors' => $supplier->getErrors()]);
        }
        $this->viewBuilder()->setOption('serialize', ['ok', 'supplier', 'errors']);
    }

    public function edit(int $id): void
    {
        $supplier = $this->Suppliers->get($id);
        $this->Suppliers->patchEntity($supplier, $this->request->getData());

        if ($this->Suppliers->save($supplier)) {
            $this->set(['ok' => true, 'supplier' => $supplier]);
        } else {
            $this->response = $this->response->withStatus(400);
            $this->set(['ok' => false, 'errors' => $supplier->getErrors()]);
        }
        $this->viewBuilder()->setOption('serialize', ['ok', 'supplier', 'errors']);
    }

    public function delete(int $id): void
    {
        $supplier = $this->Suppliers->get($id);
        $this->Suppliers->delete($supplier);

        $this->set(['ok' => true]);
        $this->viewBuilder()->setOption('serialize', ['ok']);
    }
}
