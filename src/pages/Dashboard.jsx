import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const [stats, setStats] = useState({ revenue: 0, orders: 0, avg: 0 })
  const [recent, setRecent] = useState([])
  const [profile, setProfile] = useState(null)
  const [lowStock, setLowStock] = useState([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('users').select('*, stores(*)').eq('id', user.id).single()
      setProfile(prof)

      const today = new Date().toISOString().split('T')[0]
      const { data: orders } = await supabase
        .from('orders')
        .select('total, created_at, order_number, status')
        .eq('store_id', prof.store_id)
        .eq('status', 'completed')
        .gte('created_at', today + 'T00:00:00')
        .order('created_at', { ascending: false })

      const revenue = (orders || []).reduce((s, o) => s + o.total, 0)
      setStats({
        revenue: revenue.toFixed(2),
        orders: (orders || []).length,
        avg: orders?.length ? (revenue / orders.length).toFixed(2) : '0.00',
      })
      setRecent((orders || []).slice(0, 5))

      const { data: products } = await supabase
        .from('products')
        .select('name, stock, low_stock_threshold, emoji')
        .eq('store_id', prof.store_id)
        .eq('is_active', true)
      setLowStock((products || []).filter(p => p.stock <= p.low_stock_threshold))
    }
    load()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/quickpos/#/login'
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏪</span>
          <div>
            <div className="font-bold">{profile?.stores?.name || 'Loading...'}</div>
            <div className="text-xs text-gray-400">{profile?.role}</div>
          </div>
        </div>
        <div className="flex gap-3">
          <Link to="/pos" className="bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-lg text-sm font-bold transition-colors">Open POS</Link>
          <button onClick={handleSignOut} className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition-colors">Sign Out</button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Today's Overview</h1>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Revenue Today', value: 'Rp. ' + stats.revenue, color: 'text-violet-400' },
            { label: 'Orders', value: stats.orders, color: 'text-white' },
            { label: 'Avg Order', value: 'Rp. ' + stats.avg, color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="text-xs text-gray-400 uppercase tracking-widest mb-2">{s.label}</div>
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="font-bold mb-4">Recent Orders</h2>
            {recent.length === 0 && <p className="text-gray-500 text-sm">No orders yet today.</p>}
            {recent.map(o => (
              <div key={o.order_number} className="flex justify-between py-2 border-b border-gray-800 last:border-0">
                <span className="text-gray-400 text-sm">#{o.order_number}</span>
                <span className="font-bold text-sm">${o.total.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="font-bold mb-4">⚠️ Low Stock Alerts</h2>
            {lowStock.length === 0 && <p className="text-gray-500 text-sm">All products well stocked.</p>}
            {lowStock.map(p => (
              <div key={p.name} className="flex justify-between py-2 border-b border-gray-800 last:border-0">
                <span className="text-sm">{p.emoji} {p.name}</span>
                <span className={`text-sm font-bold ${p.stock === 0 ? 'text-red-400' : 'text-amber-400'}`}>
                  {p.stock === 0 ? 'Out' : p.stock + ' left'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Link to="/products" className="bg-gray-800 hover:bg-gray-700 px-5 py-3 rounded-xl text-sm font-bold transition-colors">📦 Manage Products</Link>
          <Link to="/orders" className="bg-gray-800 hover:bg-gray-700 px-5 py-3 rounded-xl text-sm font-bold transition-colors">🧾 Order History</Link>
          <Link to="/settings" className="bg-gray-800 hover:bg-gray-700 px-5 py-3 rounded-xl text-sm font-bold transition-colors">⚙️ Settings</Link>
        </div>
      </div>
    </div>
  )
}