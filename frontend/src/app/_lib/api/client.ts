import axios, { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost/api',
  headers: { 'Content-Type': 'application/json' },
});

// APIキャッシュはデフォルト無効（必要時のみ明示ON）
const ENABLE_CACHE = process.env.NEXT_PUBLIC_ENABLE_API_CACHE === 'true';
const CACHE_TTL = 5 * 60 * 1000; // 5分

// 簡易キャッシュ（クライアントサイドのみ）
const getCache = (): Map<string, { data: any; timestamp: number }> | null => {
  if (!ENABLE_CACHE || typeof window === 'undefined') return null;
  if (!(window as any).__apiCache) {
    (window as any).__apiCache = new Map();
  }
  return (window as any).__apiCache;
};

// リクエストごとにトークンを付与
client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // GETリクエストのキャッシュチェック
  const cache = getCache();
  if (cache && config.method === 'get' && config.url) {
    try {
      const cacheKey = `${config.url}${config.params ? JSON.stringify(config.params) : ''}`;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        config.adapter = () => Promise.resolve({
          data: cached.data,
          status: 200,
          statusText: 'OK (cached)',
          headers: {},
          config,
        } as any);
      }
    } catch (e) {
      // キャッシュエラーは無視
    }
  }
  
  return config;
});

// レスポンスをキャッシュに保存
client.interceptors.response.use((response) => {
  const cache = getCache();
  if (cache && response.config.method === 'get' && response.config.url) {
    try {
      const cacheKey = `${response.config.url}${response.config.params ? JSON.stringify(response.config.params) : ''}`;
      cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
    } catch (e) {
      // キャッシュエラーは無視
    }
  }
  return response;
});

export default client;

// キャッシュをクリアする関数
export const clearCache = () => {
  try {
    const cache = getCache();
    if (cache) {
      cache.clear();
    }
  } catch (e) {
    // エラーは無視
  }
};

const withCacheClear = async <T>(request: Promise<T>): Promise<T> => {
  const res = await request;
  clearCache();
  return res;
};

// --- Auth ---
export const login = (login_id: string, password: string) =>
  client.post<{ ok: boolean; token: string; user: AuthUser }>('/auth/login', { login_id, password });
export const logout = () => client.post('/auth/logout');
export const getMe = () => client.get<{ ok: boolean; user: AuthUser }>('/auth/me');

// --- Users ---
export const fetchUsers = () => client.get<{ ok: boolean; users: UserRecord[] }>('/users');
export const createUser = (data: UserInput) => withCacheClear(client.post<{ ok: boolean; user: UserRecord }>('/users', data));
export const updateUser = (id: number, data: Partial<UserInput>) => withCacheClear(client.put<{ ok: boolean; user: UserRecord }>(`/users/${id}`, data));
export const deleteUser = (id: number) => withCacheClear(client.delete(`/users/${id}`));

// --- Orders ---
export const fetchOrders = () => client.get('/orders');
export const fetchOrderSummary = (date: string) =>
  client.get(`/orders/summary?date=${date}`);
export const createOrder = (data: OrderInput) => withCacheClear(client.post('/orders', data));
export const updateOrder = (id: number, data: Partial<OrderInput>) =>
  withCacheClear(client.put(`/orders/${id}`, data));
export const deleteOrder = (id: number) => withCacheClear(client.delete(`/orders/${id}`));

// --- Menus ---
export const fetchMenus = (date?: string) =>
  client.get<{ menus: MenuItem[] }>(`/menus${date ? `?date=${date}` : ''}`);
export const fetchMenusByMonth = (year: number, month: number) =>
  client.get<{ menus: MenuItem[] }>(`/menus?year=${year}&month=${month}`);
export const saveMenu = async (data: MenuInput) => {
  const res = await client.post<{ success: boolean; menu: MenuItem }>('/menus', data);
  clearCache(); // データ更新時はキャッシュクリア
  return res;
};
export const deleteMenu = async (id: number) => {
  const res = await client.delete(`/menus/${id}`);
  clearCache();
  return res;
};
export const copyMenusRoutine = async (data: MenuRoutineCopyInput) => {
  const res = await client.post<MenuRoutineCopyResponse>('/menus/copy-routine', data);
  clearCache();
  return res;
};
export const scheduleMenusRoutine = async (data: MenuScheduleRoutineInput) => {
  const res = await client.post<MenuScheduleRoutineResponse>('/menus/schedule-routine', data);
  clearCache();
  return res;
};

// --- Menu Ingredients ---
export const fetchMenuIngredients = (menuMasterId: number) =>
  client.get<{ ok: boolean; ingredients: MenuIngredient[] }>(`/menu-ingredients?menu_master_id=${menuMasterId}`);
export const saveMenuIngredients = (menuMasterId: number, items: MenuIngredientInput[]) =>
  withCacheClear(client.post<{ ok: boolean; ingredients: MenuIngredient[] }>('/menu-ingredients', { menu_master_id: menuMasterId, items }));

// --- Menu Masters ---
export const fetchMenuMasters = (blockId?: number) =>
  client.get<{ ok: boolean; menu_masters: MenuMaster[] }>(
    blockId != null ? `/menu-masters?block_id=${blockId}` : '/menu-masters'
  );
export const createMenuMaster = (data: MenuMasterInput) =>
  withCacheClear(client.post<{ ok: boolean; menu_master: MenuMaster }>('/menu-masters', data));
export const updateMenuMaster = (id: number, data: MenuMasterInput) =>
  withCacheClear(client.put<{ ok: boolean; menu_master: MenuMaster }>(`/menu-masters/${id}`, data));
export const deleteMenuMaster = (id: number) =>
  withCacheClear(client.delete(`/menu-masters/${id}`));

// --- Suppliers ---
export const fetchSuppliers = () => client.get<{ ok: boolean; suppliers: Supplier[] }>('/suppliers');
export const createSupplier = (data: SupplierInput) => withCacheClear(client.post<{ ok: boolean; supplier: Supplier }>('/suppliers', data));
export const updateSupplier = (id: number, data: SupplierInput) => withCacheClear(client.put<{ ok: boolean; supplier: Supplier }>(`/suppliers/${id}`, data));
export const deleteSupplier = (id: number) => withCacheClear(client.delete(`/suppliers/${id}`));
export const uploadSupplierTemplate = (id: number, file: File) => {
  const form = new FormData();
  form.append('template', file);
  return withCacheClear(client.post<{ ok: boolean; message: string; has_custom_template: boolean }>(
    `/suppliers/${id}/template`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  ));
};
export const deleteSupplierTemplate = (id: number) =>
  withCacheClear(client.delete<{ ok: boolean; message: string; has_custom_template: boolean }>(`/suppliers/${id}/template`));
export const downloadSupplierTemplate = (id: number) =>
  client.get(`/suppliers/${id}/template`, { responseType: 'blob' });

// --- Order Sheets ---
export const fetchOrderSheetPreview = (weekStart: string) =>
  client.get<OrderSheetPreviewResponse>(`/order-sheets/calculate?week_start=${weekStart}`);
export const fetchInventoryPreview = (weekStart: string) =>
  client.get<InventoryPreviewResponse>(`/order-sheets/inventory?week_start=${weekStart}`);
export const downloadOrderSheet = (
  weekStart: string,
  supplierId: number,
  days: Record<string, { name: string; amount: number; unit: string }[]>,
) =>
  client.post(`/order-sheets/download`, { week_start: weekStart, supplier_id: supplierId, days }, { responseType: 'blob' });
export const fetchOrderSheetPdf = (
  weekStart: string,
  supplierId: number,
  days: Record<string, { name: string; amount: number; unit: string }[]>,
) =>
  client.post(`/order-sheets/pdf`, { week_start: weekStart, supplier_id: supplierId, days }, { responseType: 'blob' });

// --- Coop Orders (生協発注) ---
export const fetchCoopOrders = (weekStart: string) =>
  client.get<CoopOrdersResponse>(`/coop-orders?week_start=${weekStart}`)
export const saveCoopOrders = (data: SaveCoopOrdersInput) =>
  withCacheClear(client.post<{ ok: boolean; saved: number }>('/coop-orders', data))

// --- Menu Table (献立表) ---
export const fetchMenuTable = (weekStart: string) =>
  client.get<MenuTableResponse>(`/menu-table?week_start=${weekStart}`)
export const downloadMenuTableExcel = (weekStart: string, type: 'staff' | 'children') =>
  client.get(`/menu-table/excel?week_start=${weekStart}&type=${type}`, { responseType: 'blob' })
export const fetchMenuTablePdf = (weekStart: string, type: 'staff' | 'children') =>
  client.get(`/menu-table/pdf?week_start=${weekStart}&type=${type}`, { responseType: 'blob' })

// --- AI ---
export const suggestMenuByAi = (data: AiMenuSuggestInput) =>
  client.post<AiMenuSuggestResponse>('/ai/menu-suggest', data)
export const draftMenuMasterByAi = (data: AiMenuMasterDraftInput) =>
  client.post<AiMenuMasterDraftResponse>('/ai/menu-master-draft', data)

// --- Kamaho Rooms Sync ---
export const syncKamahoRooms = () =>
  client.post<{ ok: boolean; added: string[]; rooms: Room[]; kamaho_rooms: string[] }>('/rooms/sync-kamaho');

// --- Kamaho meal counts ---
/** kamaho-shokusu.jp から指定日の食数を取得する */
export const fetchKamahoMealCounts = (date: string) =>
  client.get<KamahoMealCountsResponse>(`/kamaho-meal-counts?date=${date}`);

// --- Daily order quantities (旧) ---
export const fetchOrderQuantities = (date: string) =>
  client.get<OrderQuantitiesResponse>(`/order-quantities?date=${date}`);
export const saveOrderQuantities = (data: SaveOrderQuantitiesInput) =>
  withCacheClear(client.post<{ ok: boolean; saved: OrderQuantityItem[] }>('/order-quantities', data));

// --- Rooms ---
export const fetchRooms = () => client.get<{ ok: boolean; rooms: Room[] }>('/rooms');
export const createRoom = (data: { name: string; sort_order?: number }) =>
  withCacheClear(client.post<{ ok: boolean; room: Room }>('/rooms', data));
export const deleteRoom = (id: number) => withCacheClear(client.delete(`/rooms/${id}`));

// --- Blocks ---
export const fetchBlocks = () => client.get<{ ok: boolean; blocks: Block[] }>('/blocks');
export const createBlock = (data: { name: string; room1_id: number; room2_id: number; sort_order?: number }) =>
  withCacheClear(client.post<{ ok: boolean; block: Block }>('/blocks', data));
export const deleteBlock = (id: number) => withCacheClear(client.delete(`/blocks/${id}`));


// --- Block order quantities (新) ---
export const fetchBlockOrderQuantities = (date: string) =>
  client.get<BlockOrderQuantitiesResponse>(`/block-order-quantities?date=${date}`);
export const saveBlockOrderQuantities = (data: SaveBlockOrderQuantitiesInput) =>
  withCacheClear(client.post('/block-order-quantities', data));

// --- Types ---
export interface AuthUser {
  id: number;
  name: string;
  role: 'admin' | 'user';
  block_id: number | null;
}

export interface UserRecord {
  id: number;
  name: string;
  login_id: string;
  role: 'admin' | 'user';
  block_id: number | null;
  created?: string;
}

export interface UserInput {
  name: string;
  login_id?: string;
  password?: string;
  role: 'admin' | 'user';
  block_id?: number | null;
}

export interface OrderInput {
  user_id: number;
  menu_id: number;
  quantity: number;
  order_date: string;
  note?: string;
}

export interface MenuInput {
  name: string;
  menu_date: string;
  meal_type: MealType;
  block_id: number;
  grams_per_person?: number;
}

export interface MenuItem {
  id: number;
  name: string;
  menu_date: string;
  meal_type: MealType;
  block_id: number;
  grams_per_person: number;
  menu_ingredients?: MenuIngredient[];
}

export interface MenuRoutineCopyInput {
  source_start: string;
  target_start: string;
  months?: number;
  include_birthday_menu?: boolean;
  replace_existing?: boolean;
  block_id?: number | null;
}

export interface MenuScheduleRoutineInput {
  source_start: string;
  source_end: string;
  target_start: string;
  target_end: string;
  cycle_months?: number;
  include_birthday_menu?: boolean;
  overwrite?: boolean;
  block_id?: number | null;
}

export interface MenuScheduleRoutineResponse {
  ok: boolean;
  source_start: string;
  source_end: string;
  target_start: string;
  target_end: string;
  cycle_months: number;
  cycles: number;
  deleted: number;
  copied: number;
  skipped: number;
  message?: string;
}

export interface MenuRoutineCopyResponse {
  ok: boolean;
  source_start: string;
  source_end: string;
  target_start: string;
  target_end: string;
  months: number;
  deleted: number;
  copied: number;
  message?: string;
}

export interface AiMenuSuggestInput {
  date: string;
  block_id?: number | null;
  existing_by_meal?: Record<string, string[]>;
}

export interface AiMenuSuggestResponse {
  ok: boolean;
  date: string;
  block_id: number | null;
  suggestions: Record<string, string[]>;
  candidate_count: number;
  raw?: string;
  message?: string;
}

export interface AiMenuMasterDraftInput {
  name?: string;
  block_id?: number | null;
}

export interface AiMenuMasterDraftResponse {
  ok: boolean;
  name: string;
  name_generated?: boolean;
  draft: {
    grams_per_person: number;
    memo: string;
    ingredients: MenuIngredientInput[];
  };
  raw?: string;
  message?: string;
}

export interface MenuIngredient {
  id: number;
  menu_master_id: number;
  name: string;
  amount: number;
  unit: string;
  persons_per_unit: number | null;
  supplier_id: number | null;
  sort_order: number;
}

export interface MenuIngredientInput {
  name: string;
  amount: number;
  unit: string;
  persons_per_unit?: number | null;
  supplier_id?: number | null;
}

export interface MenuMaster {
  id: number;
  name: string;
  dish_category: string | null;
  block_id: number | null;
  grams_per_person: number;
  memo: string;
  menu_ingredients?: MenuIngredient[];
}

export interface MenuMasterInput {
  name: string;
  dish_category?: string | null;
  block_id?: number | null;
  grams_per_person?: number;
  memo?: string;
  ingredients?: MenuIngredientInput[];
}

/** 食事種別 (1=朝食, 2=昼食, 3=夕食, 4=弁当) */
export type MealType = 1 | 2 | 3 | 4;

export interface KamahoMealCountsResponse {
  ok: boolean;
  date: string;
  /** meal_type (string key) => 食数 */
  counts: Record<string, number>;
}

export interface OrderQuantityItem {
  id: number;
  order_date: string;
  meal_type: MealType;
  kamaho_count: number | null;
  order_quantity: number;
  notes: string | null;
}

export interface OrderQuantitiesResponse {
  ok: boolean;
  date: string;
  quantities: OrderQuantityItem[];
}

export interface SaveOrderQuantitiesInput {
  order_date: string;
  items: Array<{
    meal_type: MealType;
    kamaho_count: number | null;
    order_quantity: number;
    notes?: string;
  }>;
}

export interface Room {
  id: number;
  name: string;
  sort_order: number;
}

export interface Block {
  id: number;
  name: string;
  room1_id: number;
  room2_id: number;
  sort_order: number;
  room1?: Room;
  room2?: Room;
}

export interface BlockQuantityRow {
  meal_type: MealType;
  menu_name: string | null;
  grams_per_person: number;
  room1_kamaho_count: number;
  room2_kamaho_count: number;
  total_kamaho_count: number;
  total_grams: number;
  order_quantity: number;
  notes: string;
  saved_id: number | null;
}

export interface BlockWithQuantities {
  id: number;
  name: string;
  room1: { id: number | null; name: string | null };
  room2: { id: number | null; name: string | null };
  quantities: BlockQuantityRow[];
}

export interface BlockOrderQuantitiesResponse {
  ok: boolean;
  date: string;
  blocks: BlockWithQuantities[];
}

export interface SaveBlockOrderQuantitiesInput {
  order_date: string;
  items: Array<{
    block_id: number;
    meal_type: MealType;
    room1_kamaho_count: number;
    room2_kamaho_count: number;
    order_quantity: number;
    notes?: string;
  }>;
}

// --- Coop types ---
export interface CoopItem {
  id: number
  name: string
  unit: string
  order_type: 'weekly' | 'daily'
  sort_order: number
  // weekly
  quantity?: number
  notes?: string
  // daily
  daily?: Record<string, number>
}

export interface CoopOrdersResponse {
  ok: boolean
  week_start: string
  week_end: string
  items: CoopItem[]
}

export interface SaveCoopOrdersInput {
  week_start: string
  items: Array<{
    item_id: number
    quantity?: number
    notes?: string
    daily?: Record<string, number>
  }>
}

export interface Supplier {
  id: number;
  name: string;
  code: string | null;
  has_order_sheet: 0 | 1;
  delivery_days: string;
  order_day: number | null;
  delivery_lead_weeks: 0 | 1;
  file_ext: string;
  notes: string | null;
  has_custom_template: boolean;
}

export interface SupplierInput {
  name: string;
  code?: string;
  has_order_sheet?: 0 | 1;
  delivery_days: string;
  order_day?: number | null;
  delivery_lead_weeks?: 0 | 1;
  file_ext: string;
  notes?: string;
}

export interface InventoryPreviewResponse {
  ok: boolean
  week_start: string
  /** dateStr => ingredients */
  days: Record<string, { name: string; amount: number; unit: string }[]>
}

export interface OrderSheetIngredient {
  name: string;
  amount: number;
  unit: string;
}

export interface OrderSheetSupplier {
  supplier_id: number;
  supplier_name: string;
  days: Record<string, OrderSheetIngredient[]>;
}

export interface OrderSheetPreviewResponse {
  ok: boolean;
  week_start: string;
  suppliers: OrderSheetSupplier[];
}

export interface MenuTableIngredient {
  name: string
  amount: number
  unit: string
  supplier_code: string
  delivery_date: string
}

export interface MenuTableMenu {
  menu_name: string
  ingredients: MenuTableIngredient[]
}

export interface MenuTableDay {
  date: string
  meals: Record<string, MenuTableMenu[]>
}

export interface MenuTableResponse {
  ok: boolean
  week_start: string
  week_end: string
  /** dayIndex 0=Mon .. 6=Sun (配列で返却) */
  days: MenuTableDay[]
}

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  1: '朝食',
  2: '昼食',
  3: '夕食',
  4: '弁当',
};
