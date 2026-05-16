import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'
import LangToggle from '../components/LangToggle'

function formatRp(amount) {
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID')
}

const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

export default function Dashboard() {
  const { t, lang } = useLang()
  const MONTHS = lang === 'en' ? MONTHS_EN : MONTHS_ID
  const now = new Date()

  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear())
  const [stats,    setStats]   = useState({ revenue: 0, orders: 0, avg: 0 })
  const [recent,   setRecent]  = useState([])
  const [profile,  setProfile] = useState(null)
  const [lowStock, setLowStock]= useState([])
  const [loading,  setLoading] = useState(true)

  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase
        .from('users').select('*, stores(*)').eq('id', user.id).single()
      setProfile(prof)
      loadStats(prof.store_id, selectedMonth, selectedYear)
    }
    init()
  }, [])

  useEffect(() => {
    if (profile?.store_id) loadStats(profile.store_id, selectedMonth, selectedYear)
  }, [selectedMonth, selectedYear])

  async function loadStats(storeId, month, year) {
    setLoading(true)
    const start = new Date(year, month, 1).toISOString()
    const end   = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

    const [ordersRes, prodsRes] = await Promise.all([
      supabase.from('orders').select('total, created_at, order_number, status')
        .eq('store_id', storeId).eq('status', 'completed')
        .gte('created_at', start).lte('created_at', end)
        .order('created_at', { ascending: false }),
      supabase.from('products').select('name, stock, low_stock_threshold, emoji, image_url')
        .eq('store_id', storeId).eq('is_active', true),
    ])

    const orders  = ordersRes.data || []
    const revenue = orders.reduce((s, o) => s + o.total, 0)
    setStats({ revenue, orders: orders.length, avg: orders.length ? revenue / orders.length : 0 })
    setRecent(orders.slice(0, 6))
    setLowStock((prodsRes.data || []).filter(p => p.stock <= p.low_stock_threshold))
    setLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/quickpos/#/login'
  }

  const isOwner     = profile?.role === 'owner'
  const isThisMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl flex-shrink-0">🏪</span>
            <div className="min-w-0">
              <div className="font-bold truncate text-sm sm:text-base">{profile?.stores?.name || '...'}</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400">{profile?.role}</span>
                {profile?.stores?.store_code && (
                  <span className="text-xs text-gray-500 font-mono bg-gray-800 px-1.5 py-0.5 rounded">
                    {profile.stores.store_code}
                  </span>
                )}
                {profile?.stores?.plan === 'pro' && (
                  <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-md font-bold">PRO</span>
                )}
                {profile?.stores?.plan === 'free' && (
                  <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md font-bold">FREE</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <LangToggle />
            <Link to="/pos"
              className="bg-violet-600 hover:bg-violet-500 px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap">
              {t.openPOS}
            </Link>
            <button onClick={handleSignOut}
              className="bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap hidden sm:block">
              {t.signOut}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5">
        {/* Month/year filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h1 className="text-lg sm:text-xl font-bold">
            {isThisMonth ? t.thisMonth : `${MONTHS[selectedMonth]} ${selectedYear}`}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 flex-1 sm:flex-none">
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {!isThisMonth && (
              <button onClick={() => { setSelectedMonth(now.getMonth()); setSelectedYear(now.getFullYear()) }}
                className="bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 px-3 py-2 rounded-lg text-sm transition-colors">
                {t.today}
              </button>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: t.revenue,     value: formatRp(stats.revenue), color: 'text-violet-400' },
            { label: t.ordersCount, value: stats.orders,             color: 'text-white' },
            { label: t.avgOrder,    value: formatRp(stats.avg),      color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-5">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1 sm:mb-2 leading-tight">{s.label}</div>
              <div className={`text-lg sm:text-2xl font-bold ${s.color} truncate`}>
                {loading ? '...' : s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Two columns → stack on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="font-bold mb-3 text-sm sm:text-base">{t.recentOrders}</h2>
            {loading && <p className="text-gray-500 text-sm">{t.loading}</p>}
            {!loading && recent.length === 0 && (
              <p className="text-gray-500 text-sm">{t.noOrders} {MONTHS[selectedMonth]} {selectedYear}.</p>
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

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h2 className="font-bold mb-3 text-sm sm:text-base">{t.lowStockAlerts}</h2>
            {lowStock.length === 0 && <p className="text-gray-500 text-sm">{t.allStocked}</p>}
            {lowStock.map(p => (
              <div key={p.name} className="flex items-center gap-2 py-2 border-b border-gray-800 last:border-0">
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} className="w-7 h-7 rounded object-cover flex-shrink-0" />
                  : <span className="text-lg flex-shrink-0">{p.emoji}</span>}
                <span className="text-sm flex-1 truncate">{p.name}</span>
                <span className={`text-sm font-bold flex-shrink-0 ${p.stock === 0 ? 'text-red-400' : 'text-amber-400'}`}>
                  {p.stock === 0 ? t.outOfStockLabel : p.stock + ' left'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Nav links - owner only, scrollable on mobile */}
        {isOwner && (
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {[
              { to: '/products', icon: '📦', label: t.products },
              { to: '/orders',   icon: '🧾', label: t.orders },
              { to: '/staff',    icon: '👥', label: t.staff },
              { to: '/settings', icon: '⚙️', label: t.settings },
            ].map(({ to, icon, label }) => (
              <Link key={to} to={to}
                className="bg-gray-800 hover:bg-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors whitespace-nowrap flex items-center gap-1.5">
                {icon} {label}
              </Link>
            ))}
            <button onClick={handleSignOut}
              className="bg-gray-800 hover:bg-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 sm:hidden">
              🚪 {t.signOut}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
