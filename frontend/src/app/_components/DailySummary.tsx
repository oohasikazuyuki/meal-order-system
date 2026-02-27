'use client'

import { useState } from 'react'
import { fetchOrderSummary } from '../_lib/api/client'
import dayjs from 'dayjs'

interface Order {
  id: number
  quantity: number
  menu: { name: string; meal_type: string }
}

export default function DailySummary() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [orders, setOrders] = useState<Order[]>([])
  const [searched, setSearched] = useState(false)

  const handleSearch = () => {
    fetchOrderSummary(date).then(res => {
      setOrders(res.data.orders)
      setSearched(true)
    })
  }

  const summary = orders.reduce((acc, order) => {
    const key = order.menu?.name
    acc[key] = (acc[key] || 0) + order.quantity
    return acc
  }, {} as Record<string, number>)

  const total = Object.values(summary).reduce((a, b) => a + b, 0)

  return (
    <div style={{ padding: '2rem' }}>
      <h2>日別食数集計</h2>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <button onClick={handleSearch}>集計</button>
      </div>

      {searched && (
        <table style={{ borderCollapse: 'collapse', minWidth: 300 }}>
          <thead>
            <tr>
              <th style={th}>メニュー名</th>
              <th style={th}>食数合計</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(summary).map(([name, qty]) => (
              <tr key={name}>
                <td style={td}>{name}</td>
                <td style={td}>{qty}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...td, fontWeight: 'bold' }}>合計</td>
              <td style={{ ...td, fontWeight: 'bold' }}>{total}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}

const th: React.CSSProperties = {
  border: '1px solid #ccc', padding: '0.5rem', background: '#f5f5f5',
}
const td: React.CSSProperties = {
  border: '1px solid #ccc', padding: '0.5rem',
}
