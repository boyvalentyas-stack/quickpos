import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'
import LangToggle from '../components/LangToggle'

function formatRp(amount) {
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID')
}

export default function Orders() {
  const { t } = useLang()
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('users').select('store_id').eq('id', user.id).single()
      const { data } = await supabase.from('orders').select('*, order_items(*)')
        .eq('store_id', prof.store_id).order('created_at', { ascending: false }).limit(200)
      setOrders(data || [])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm flex-shrink-0">{t.back}</Link>
        <h1 className="font-bold">{t.orders}</h1>
        <div className="ml-auto"><LangToggle /></div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5">
        {/* Desktop table */}
        <div className="hidden sm:block bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {[t.orderNumber, t.dateTime, t.items, t.total, t.payment, t.status].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-widest font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-sm font-bold text-violet-400">#{o.order_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {new Date(o.created_at).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                  </td>
                  <td className="px-4 py-3 text-sm">{o.order_items?.length ?? 0} {t.items}</td>
                  <td className="px-4 py-3 text-sm font-bold">{formatRp(o.total)}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {o.payment_method === 'qris' ? '📱 QRIS' : '💵 ' + t.cash}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${o.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && !loading && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">{t.noOrdersYet}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="sm:hidden space-y-3">
          {loading && <p className="text-gray-500 text-sm text-center py-8">{t.loading}</p>}
          {orders.map(o => (
            <div key={o.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-violet-400">#{o.order_number}</span>
                <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${o.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {o.status}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">
                  {new Date(o.created_at).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                </span>
                <span className="font-bold">{formatRp(o.total)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{o.order_items?.length ?? 0} {t.items}</span>
                <span>{o.payment_method === 'qris' ? '📱 QRIS' : '💵 ' + t.cash}</span>
              </div>
            </div>
          ))}
          {orders.length === 0 && !loading && (
            <p className="text-center text-gray-500 py-10">{t.noOrdersYet}</p>
          )}
        </div>
      </div>
    </div>
  )
}
