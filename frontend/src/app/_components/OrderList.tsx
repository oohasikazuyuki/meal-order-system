'use client'

import { useState, useEffect } from 'react'
import { fetchOrders, deleteOrder } from '../_lib/api/client'

interface Order {
  id: number
  quantity: number
  order_date: string
  status: string
  user: { name: string }
  menu: { name: string; meal_type: string }
}

const statusLabel: Record<string, string> = {
  pending: '受付中',
  confirmed: '確定',
  cancelled: 'キャンセル',
}

export default function OrderList() {
  const [orders, setOrders] = useState<Order[]>([])

  const load = () => {
    fetchOrders().then(res => setOrders(res.data.orders))
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: number) => {
    if (!window.confirm('この発注を削除しますか？')) return
    await deleteOrder(id)
    load()
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h2>発注一覧</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['発注日', '発注者', 'メニュー', '食数', 'ステータス', '操作'].map(h => (
              <th key={h} style={{ border: '1px solid #ccc', padding: '0.5rem', background: '#f5f5f5' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.id}>
              <td style={td}>{order.order_date}</td>
              <td style={td}>{order.user?.name}</td>
              <td style={td}>{order.menu?.name}</td>
              <td style={td}>{order.quantity}</td>
              <td style={td}>{statusLabel[order.status]}</td>
              <td style={td}>
                <button onClick={() => handleDelete(order.id)}>削除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const td: React.CSSProperties = {
  border: '1px solid #ccc', padding: '0.5rem',
}
