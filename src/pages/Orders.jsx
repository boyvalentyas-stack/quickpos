import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

export default function Orders() {
  const [orders, setOrders] = useState([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('users').select('store_id').eq('id', user.id).single()
      const { data } = await supabase.from('orders').select('*, order_items(*)').eq('store_id', prof.store_id).order('created_at', { ascending: false }).limit(100)
      setOrders(data || [])
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm">← Dashboard</Link>
        <h1 className="font-bold text-lg">Order History</h1>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {['Order #','Date & Time','Items','Total','Payment','Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-widest font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-sm font-bold text-violet-400">#{o.order_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{new Date(o.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">{o.order_items?.length ?? 0} items</td>
                  <td className="px-4 py-3 text-sm font-bold">${o.total.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{o.payment_method}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${o.status==='completed' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{o.status}</span>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">No orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}