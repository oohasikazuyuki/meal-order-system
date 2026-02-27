import axios from 'axios';

const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost/api',
  headers: { 'Content-Type': 'application/json' },
});

// リクエストごとにトークンを付与
client.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;

// --- Auth ---
export const login = (login_id: string, password: string) =>
  client.post<{ ok: boolean; token: string; user: AuthUser }>('/auth/login.json', { login_id, password });
export const logout = () => client.post('/auth/logout.json');
export const getMe = () => client.get<{ ok: boolean; user: AuthUser }>('/auth/me.json');

// --- Users ---
export const fetchUsers = () => client.get<{ ok: boolean; users: UserRecord[] }>('/users.json');
export const createUser = (data: UserInput) => client.post<{ ok: boolean; user: UserRecord }>('/users.json', data);
export const updateUser = (id: number, data: Partial<UserInput>) => client.put<{ ok: boolean; user: UserRecord }>(`/users/${id}.json`, data);
export const deleteUser = (id: number) => client.delete(`/users/${id}.json`);

// --- Orders ---
export const fetchOrders = () => client.get('/orders.json');
export const fetchOrderSummary = (date: string) =>
  client.get(`/orders/summary.json?date=${date}`);
export const createOrder = (data: OrderInput) => client.post('/orders.json', data);
export const updateOrder = (id: number, data: Partial<OrderInput>) =>
  client.put(`/orders/${id}.json`, data);
export const deleteOrder = (id: number) => client.delete(`/orders/${id}.json`);

// --- Menus ---
export const fetchMenus = (date?: string) =>
  client.get<{ menus: MenuItem[] }>(`/menus.json${date ? `?date=${date}` : ''}`);
export const fetchMenusByMonth = (year: number, month: number) =>
  client.get<{ menus: MenuItem[] }>(`/menus.json?year=${year}&month=${month}`);
export const saveMenu = (data: MenuInput) => client.post<{ success: boolean; menu: MenuItem }>('/menus.json', data);
export const deleteMenu = (id: number) => client.delete(`/menus/${id}.json`);

// --- Menu Ingredients ---
export const fetchMenuIngredients = (menuMasterId: number) =>
  client.get<{ ok: boolean; ingredients: MenuIngredient[] }>(`/menu-ingredients.json?menu_master_id=${menuMasterId}`);
export const saveMenuIngredients = (menuMasterId: number, items: MenuIngredientInput[]) =>
  client.post<{ ok: boolean; ingredients: MenuIngredient[] }>('/menu-ingredients.json', { menu_master_id: menuMasterId, items });

// --- Menu Masters ---
export const fetchMenuMasters = (blockId?: number) =>
  client.get<{ ok: boolean; menu_masters: MenuMaster[] }>(
    blockId != null ? `/menu-masters.json?block_id=${blockId}` : '/menu-masters.json'
  );
export const createMenuMaster = (data: MenuMasterInput) =>
  client.post<{ ok: boolean; menu_master: MenuMaster }>('/menu-masters.json', data);
export const updateMenuMaster = (id: number, data: MenuMasterInput) =>
  client.put<{ ok: boolean; menu_master: MenuMaster }>(`/menu-masters/${id}.json`, data);
export const deleteMenuMaster = (id: number) =>
  client.delete(`/menu-masters/${id}.json`);

// --- Kamaho Rooms Sync ---
export const syncKamahoRooms = () =>
  client.post<{ ok: boolean; added: string[]; rooms: Room[]; kamaho_rooms: string[] }>('/rooms/sync-kamaho.json');

// --- Kamaho meal counts ---
/** kamaho-shokusu.jp から指定日の食数を取得する */
export const fetchKamahoMealCounts = (date: string) =>
  client.get<KamahoMealCountsResponse>(`/kamaho-meal-counts.json?date=${date}`);

// --- Daily order quantities (旧) ---
export const fetchOrderQuantities = (date: string) =>
  client.get<OrderQuantitiesResponse>(`/order-quantities.json?date=${date}`);
export const saveOrderQuantities = (data: SaveOrderQuantitiesInput) =>
  client.post<{ ok: boolean; saved: OrderQuantityItem[] }>('/order-quantities.json', data);

// --- Rooms ---
export const fetchRooms = () => client.get<{ ok: boolean; rooms: Room[] }>('/rooms.json');
export const createRoom = (data: { name: string; sort_order?: number }) =>
  client.post<{ ok: boolean; room: Room }>('/rooms.json', data);
export const deleteRoom = (id: number) => client.delete(`/rooms/${id}.json`);

// --- Blocks ---
export const fetchBlocks = () => client.get<{ ok: boolean; blocks: Block[] }>('/blocks.json');
export const createBlock = (data: { name: string; room1_id: number; room2_id: number; sort_order?: number }) =>
  client.post<{ ok: boolean; block: Block }>('/blocks.json', data);
export const deleteBlock = (id: number) => client.delete(`/blocks/${id}.json`);


// --- Block order quantities (新) ---
export const fetchBlockOrderQuantities = (date: string) =>
  client.get<BlockOrderQuantitiesResponse>(`/block-order-quantities.json?date=${date}`);
export const saveBlockOrderQuantities = (data: SaveBlockOrderQuantitiesInput) =>
  client.post('/block-order-quantities.json', data);

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

export interface MenuIngredient {
  id: number;
  menu_master_id: number;
  name: string;
  amount: number;
  unit: string;
  sort_order: number;
}

export interface MenuIngredientInput {
  name: string;
  amount: number;
  unit: string;
}

export interface MenuMaster {
  id: number;
  name: string;
  block_id: number | null;
  grams_per_person: number;
  memo: string;
  menu_ingredients?: MenuIngredient[];
}

export interface MenuMasterInput {
  name: string;
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

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  1: '朝食',
  2: '昼食',
  3: '夕食',
  4: '弁当',
};
