import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

function formatRp(amount) {
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID')
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function Dashboard() {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()) // 0-indexed
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear())

  const [stats,   setStats]   = useState({ revenue: 0, orders: 0, avg: 0 })
  const [recent,  setRecent]  = useState([])
  const [profile, setProfile] = useState(null)
  const [lowStock, setLowStock] = useState([])
  const [loading,  setLoading]  = useState(true)

  // Build year options: current year and 3 years back
  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase
        .from('users').select('*, stores(*)').eq('id', user.id).single()
      setProfile(prof)
      return prof
    }
    loadProfile().then(prof => loadStats(prof.store_id))
  }, [])

  useEffect(() => {
    if (profile?.store_id) loadStats(profile.store_id)
  }, [selectedMonth, selectedYear])

  async function loadStats(storeId) {
    setLoading(true)

    // Build date range for the selected month
    const startDate = new Date(selectedYear, selectedMonth, 1)
    const endDate   = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59)

    const [ordersRes, productsRes] = await Promise.all([
      supabase
        .from('orders')
        .select('total, created_at, order_number, status')
        .eq('store_id', storeId)
        .eq('status', 'completed')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false }),

      supabase
        .from('products')
        .select('name, stock, low_stock_threshold, emoji, image_url')
        .eq('store_id', storeId)
        .eq('is_active', true),
    ])

    const orders  = ordersRes.data  || []
    const revenue = orders.reduce((s, o) => s + o.total, 0)

    setStats({
      revenue,
      orders:  orders.length,
      avg:     orders.length ? revenue / orders.length : 0,
    })
    setRecent(orders.slice(0, 6))
    setLowStock((productsRes.data || []).filter(p => p.stock <= p.low_stock_threshold))
    setLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/quickpos/#/login'
  }

  const isOwner    = profile?.role === 'owner'
  const isThisMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏪</span>
          <div>
            <div className="font-bold">{profile?.stores?.name || '...'}</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{profile?.role}</span>
              {profile?.stores?.plan === 'pro' && (
                <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-md font-bold">PRO</span>
              )}
              {profile?.stores?.plan === 'free' && (
                <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md font-bold">FREE</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to="/pos" className="bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
            Open POS
          </Link>
          <button onClick={handleSignOut}
            className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition-colors">
            Sign Out
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">

        {/* Month / Year filter */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">
            {isThisMonth ? "This Month's Overview" : `${MONTHS[selectedMonth]} ${selectedYear}`}
          </h1>
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(parseInt(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(parseInt(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {!isThisMonth && (
              <button
                onClick={() => { setSelectedMonth(now.getMonth()); setSelectedYear(now.getFullYear()) }}
                className="bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 px-3 py-2 rounded-lg text-sm transition-colors">
                Today
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Revenue',    value: formatRp(stats.revenue), color: 'text-violet-400' },
            { label: 'Orders',     value: loading ? '...' : stats.orders, color: 'text-white' },
            { label: 'Avg. Order', value: loading ? '...' : formatRp(stats.avg), color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="text-xs text-gray-400 uppercase tracking-widest mb-2">{s.label}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{loading ? '...' : s.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Recent orders */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="font-bold mb-4">Recent Orders</h2>
            {loading && <p className="text-gray-500 text-sm">Loading...</p>}
            {!loading && recent.length === 0 && (
              <p className="text-gray-500 text-sm">No orders in {MONTHS[selectedMonth]} {selectedYear}.</p>
            )}
            {recent.map(o => (
              <div key={o.order_number} className="flex justify-between py-2 border-b border-gray-800 last:border-0">
                <div>
                  <span className="text-sm font-bold text-violet-400">#{o.order_number}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {new Date(o.created_at).toLocaleDateString('id-ID', { day:'2-digit', month:'short' })}
                  </span>
                </div>
                <span className="font-bold text-sm">{formatRp(o.total)}</span>
              </div>
            ))}
          </div>

          {/* Low stock */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="font-bold mb-4">⚠️ Low Stock Alerts</h2>
            {lowStock.length === 0 && <p className="text-gray-500 text-sm">All products well stocked.</p>}
            {lowStock.map(p => (
              <div key={p.name} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <span className="text-xl">{p.emoji}</span>
                )}
                <span className="text-sm flex-1">{p.name}</span>
                <span className={`text-sm font-bold ${p.stock === 0 ? 'text-red-400' : 'text-amber-400'}`}>
                  {p.stock === 0 ? 'Habis' : p.stock + ' left'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Nav buttons — owner sees all, cashier sees only POS */}
        <div className="mt-6 flex flex-wrap gap-3">
          {isOwner && (
            <>
              <Link to="/products" className="bg-gray-800 hover:bg-gray-700 px-5 py-3 rounded-xl text-sm font-bold transition-colors">📦 Products</Link>
              <Link to="/orders"   className="bg-gray-800 hover:bg-gray-700 px-5 py-3 rounded-xl text-sm font-bold transition-colors">🧾 Orders</Link>
              <Link to="/staff"    className="bg-gray-800 hover:bg-gray-700 px-5 py-3 rounded-xl text-sm font-bold transition-colors">👥 Staff</Link>
              <Link to="/settings" className="bg-gray-800 hover:bg-gray-700 px-5 py-3 rounded-xl text-sm font-bold transition-colors">⚙️ Settings</Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
