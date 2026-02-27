'use client'

import { useState, useEffect } from 'react'
import { fetchMenus, createOrder } from '../_lib/api/client'
import dayjs from 'dayjs'

interface Menu {
  id: number
  name: string
  date: string
  meal_type: string
  capacity: number
}

const mealTypeLabel: Record<string, string> = {
  breakfast: '朝食',
  lunch: '昼食',
  dinner: '夕食',
}

export default function OrderForm() {
  const [menus, setMenus] = useState<Menu[]>([])
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [orderDate, setOrderDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [message, setMessage] = useState('')

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetchMenus(orderDate).then(res => setMenus(res.data.menus as any))
  }, [orderDate])

  const handleQuantityChange = (menuId: number, value: string) => {
    setQuantities(prev => ({ ...prev, [menuId]: parseInt(value) || 0 }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      for (const [menuId, quantity] of Object.entries(quantities)) {
        if (quantity > 0) {
          await createOrder({
            user_id: 1, // TODO: 認証後に実ユーザーIDを使用
            menu_id: Number(menuId),
            quantity,
            order_date: orderDate,
          })
        }
      }
      setMessage('発注を送信しました')
      setQuantities({})
    } catch {
      setMessage('発注の送信に失敗しました')
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 640 }}>
      <h2>食数発注</h2>

      <label>
        発注日：
        <input
          type="date"
          value={orderDate}
          onChange={e => setOrderDate(e.target.value)}
          style={{ marginLeft: '0.5rem', marginBottom: '1rem' }}
        />
      </label>

      {message && (
        <p style={{ color: message.includes('失敗') ? 'red' : 'green' }}>{message}</p>
      )}

      <form onSubmit={handleSubmit}>
        {menus.length === 0 ? (
          <p>この日のメニューはありません</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['メニュー名', '区分', '定員', '食数'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {menus.map(menu => (
                <tr key={menu.id}>
                  <td style={td}>{menu.name}</td>
                  <td style={td}>{mealTypeLabel[menu.meal_type]}</td>
                  <td style={td}>{menu.capacity}</td>
                  <td style={td}>
                    <input
                      type="number"
                      min="0"
                      max={menu.capacity}
                      value={quantities[menu.id] || ''}
                      onChange={e => handleQuantityChange(menu.id, e.target.value)}
                      style={{ width: 70 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button type="submit" style={{ marginTop: '1rem', padding: '0.5rem 2rem' }}>
          発注する
        </button>
      </form>
    </div>
  )
}

const th: React.CSSProperties = {
  border: '1px solid #ccc', padding: '0.5rem', background: '#f5f5f5',
}
const td: React.CSSProperties = {
  border: '1px solid #ccc', padding: '0.5rem',
}
