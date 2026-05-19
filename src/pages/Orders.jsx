import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'
import LangToggle from '../components/LangToggle'
import { exportExcel, exportPDF } from '../lib/exportUtils'

function formatRp(amount) {
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID')
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
}

// ─────────────────────────────────────────────────────────────
// Order detail modal
// ─────────────────────────────────────────────────────────────
function OrderDetail({ order, onClose }) {
  if (!order) return null
  const subtotal = (order.order_items || []).reduce((s, i) => s + i.subtotal, 0)

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 flex-shrink-0">
          <div>
            <div className="font-mono font-bold text-base text-violet-400 break-all">
              #{order.order_number}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{formatDateTime(order.created_at)}</div>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center flex-shrink-0">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800 rounded-xl p-3">
              <div className="text-xs text-gray-400 uppercase tracking-widest mb-1.5">Cashier</div>
              <div className="font-semibold text-sm truncate">{order.users?.full_name || '—'}</div>
              <div className="text-xs text-gray-500 truncate mt-0.5">{order.users?.email || ''}</div>
              <div className="text-xs text-gray-600 mt-0.5 capitalize">{order.users?.role || ''}</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-3">
              <div className="text-xs text-gray-400 uppercase tracking-widest mb-1.5">Payment</div>
              <div className="font-semibold text-sm">
                {order.payment_method === 'qris' ? '📱 QRIS' : '💵 Cash'}
              </div>
              <div className={`text-xs font-bold mt-1 capitalize ${
                order.status === 'completed' ? 'text-green-400'
                : order.status === 'voided'  ? 'text-red-400'
                : 'text-amber-400'
              }`}>
                {order.status}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-400 uppercase tracking-widest mb-2">Items</div>
            <div className="space-y-2">
              {(order.order_items || []).length === 0 && (
                <p className="text-gray-500 text-sm">No items found.</p>
              )}
              {(order.order_items || []).map((item, idx) => (
                <div key={item.id || idx}
                  className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2.5 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{item.product_name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {formatRp(item.product_price)} × {item.quantity}
                    </div>
                  </div>
                  <div className="font-bold text-sm flex-shrink-0">{formatRp(item.subtotal)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-300">
              <span>Subtotal</span><span>{formatRp(subtotal)}</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-green-400">
                <span>Discount</span><span>− {formatRp(order.discount_amount)}</span>
              </div>
            )}
            <div className="border-t border-gray-700 pt-2 flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="text-violet-400">{formatRp(order.total)}</span>
            </div>
            {order.payment_method === 'cash' && (
              <>
                <div className="flex justify-between text-sm text-gray-300">
                  <span>Cash Received</span><span>{formatRp(order.cash_received || 0)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-green-400">
                  <span>Change</span><span>{formatRp(order.change_amount || 0)}</span>
                </div>
              </>
            )}
            {order.payment_method === 'qris' && (
              <div className="text-center text-xs text-violet-400 font-bold pt-1">
                ✓ Paid via QRIS — no change
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-800 flex-shrink-0">
          <button onClick={onClose}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-3 rounded-xl transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Orders page
// ─────────────────────────────────────────────────────────────
export default function Orders() {
  const { t } = useLang()
  const now = new Date()

  const [orders,        setOrders]        = useState([])
  const [storeInfo,     setStoreInfo]     = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [exporting,     setExporting]     = useState(null) // 'excel' | 'pdf' | null
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [filterMonth,   setFilterMonth]   = useState(now.getMonth())
  const [filterYear,    setFilterYear]    = useState(now.getFullYear())
  const [filterMethod,  setFilterMethod]  = useState('all')

  const years  = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  useEffect(() => { loadOrders() }, [filterMonth, filterYear])

  async function loadOrders() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase
      .from('users').select('store_id, stores(name, store_code)').eq('id', user.id).single()

    setStoreInfo(prof.stores)

    const start = new Date(filterYear, filterMonth, 1).toISOString()
    const end   = new Date(filterYear, filterMonth + 1, 0, 23, 59, 59).toISOString()

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items ( id, product_name, product_price, quantity, subtotal ),
        users ( full_name, email, role )
      `)
      .eq('store_id', prof.store_id)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: false })

    if (!error) setOrders(data || [])
    setLoading(false)
  }

  const filtered = filterMethod === 'all'
    ? orders
    : orders.filter(o => o.payment_method === filterMethod)

  const completedOrders = filtered.filter(o => o.status === 'completed')
  const totalRevenue    = completedOrders.reduce((s, o) => s + o.total, 0)

  const exportParams = {
    orders:    filtered,
    storeName: storeInfo?.name || 'Store',
    storeCode: storeInfo?.store_code || '----',
    month:     filterMonth,
    year:      filterYear,
  }

  async function handleExcelExport() {
    setExporting('excel')
    try {
      exportExcel(exportParams)
    } catch (err) {
      alert('Export failed: ' + err.message)
    }
    setExporting(null)
  }

  async function handlePDFExport() {
    setExporting('pdf')
    try {
      exportPDF(exportParams)
    } catch (err) {
      alert('Export failed: ' + err.message)
    }
    setExporting(null)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm flex-shrink-0">
          {t.back}
        </Link>
        <h1 className="font-bold">{t.orders}</h1>
        <div className="ml-auto flex items-center gap-2">
          <LangToggle />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5">

        {/* Filter + Export row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Month / Year */}
          <select value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
            {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Payment filter */}
          <div className="flex gap-1.5">
            {[
              { val: 'all',  label: 'All' },
              { val: 'cash', label: '💵 Cash' },
              { val: 'qris', label: '📱 QRIS' },
            ].map(({ val, label }) => (
              <button key={val} onClick={() => setFilterMethod(val)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                  filterMethod === val
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* Export buttons */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleExcelExport}
              disabled={loading || filtered.length === 0 || exporting !== null}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
            >
              {exporting === 'excel' ? '...' : '📊 Excel'}
            </button>
            <button
              onClick={handlePDFExport}
              disabled={loading || filtered.length === 0 || exporting !== null}
              className="flex items-center gap-1.5 bg-rose-700 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
            >
              {exporting === 'pdf' ? '...' : '📄 PDF'}
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Transactions', value: completedOrders.length, color: 'text-white' },
            { label: 'Revenue',      value: formatRp(totalRevenue), color: 'text-violet-400' },
            { label: 'Cash',         value: formatRp(completedOrders.filter(o=>o.payment_method==='cash').reduce((s,o)=>s+o.total,0)), color:'text-green-400' },
            { label: 'QRIS',         value: formatRp(completedOrders.filter(o=>o.payment_method==='qris').reduce((s,o)=>s+o.total,0)), color:'text-blue-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
              <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">{s.label}</div>
              <div className={`font-bold text-base truncate ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {['Receipt No.','Date & Time','Items','Cashier','Total','Payment','Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-widest font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500 text-sm">{t.loading}</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500 text-sm">{t.noOrdersYet}</td></tr>
              )}
              {filtered.map(o => (
                <tr key={o.id} onClick={() => setSelectedOrder(o)}
                  className="border-b border-gray-800 last:border-0 hover:bg-gray-800/60 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-sm text-violet-400">{o.order_number}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">{formatDateTime(o.created_at)}</td>
                  <td className="px-4 py-3 text-sm">{o.order_items?.length ?? 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-300 max-w-[120px] truncate">{o.users?.full_name || '—'}</td>
                  <td className="px-4 py-3 text-sm font-bold">{formatRp(o.total)}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {o.payment_method === 'qris' ? '📱 QRIS' : '💵 Cash'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                      o.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="sm:hidden space-y-2">
          {loading && <p className="text-gray-500 text-sm text-center py-8">{t.loading}</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-center text-gray-500 py-10">{t.noOrdersYet}</p>
          )}
          {filtered.map(o => (
            <button key={o.id} onClick={() => setSelectedOrder(o)}
              className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-left hover:border-violet-500/50 transition-colors active:scale-[0.99]">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-mono font-bold text-violet-400 text-sm leading-tight break-all">
                  {o.order_number}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-xs font-bold flex-shrink-0 ${
                  o.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {o.status}
                </span>
              </div>
              <div className="flex justify-between items-end gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-gray-500">{formatDateTime(o.created_at)}</div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">
                    {o.users?.full_name || '—'} · {o.order_items?.length ?? 0} items
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-sm">{formatRp(o.total)}</div>
                  <div className="text-xs text-gray-500">
                    {o.payment_method === 'qris' ? '📱 QRIS' : '💵 Cash'}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedOrder && (
        <OrderDetail order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}

    </div>
  )
}
 