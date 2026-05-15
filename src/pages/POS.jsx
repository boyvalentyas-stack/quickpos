import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

function formatRp(amount) {
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID')
}

export default function POS() {
  const [products,    setProducts]    = useState([])
  const [cart,        setCart]        = useState([])
  const [search,      setSearch]      = useState('')
  const [cash,        setCash]        = useState('')
  const [profile,     setProfile]     = useState(null)
  const [receipt,     setReceipt]     = useState(null)
  const [processing,  setProcessing]  = useState(false)
  const [orderError,  setOrderError]  = useState('')
  const [todayCount,  setTodayCount]  = useState(0)
  const [plan,        setPlan]        = useState('free')

  const DAY_LIMIT   = 100
  const limitHit    = plan === 'free' && todayCount >= DAY_LIMIT

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase
        .from('users').select('*, stores(*)')
        .eq('id', user.id).single()
      setProfile(prof)
      setPlan(prof.stores?.plan || 'free')

      // Load active products
      const { data: prods } = await supabase
        .from('products')
        .select('*, categories(name)')
        .eq('store_id', prof.store_id)
        .eq('is_active', true)
        .order('name')
      setProducts(prods || [])

      // Count today's orders for free plan limit display
      const today = new Date().toISOString().split('T')[0]
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', prof.store_id)
        .neq('status', 'voided')
        .gte('created_at', today + 'T00:00:00')
      setTodayCount(count || 0)
    }
    load()
  }, [])

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  )

  function addToCart(product) {
    if (product.stock === 0) return
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id)
      if (ex) {
        if (ex.qty >= product.stock) return prev
        return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, { ...product, qty: 1 }]
    })
  }

  function updateQty(id, delta) {
    setCart(prev => prev
      .map(i => i.id === id ? { ...i, qty: i.qty + delta } : i)
      .filter(i => i.qty > 0)
    )
  }

  const total   = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const cashNum = parseFloat(cash) || 0
  const change  = cashNum - total

  async function completeSale() {
    if (cart.length === 0 || cashNum < total || processing) return
    setProcessing(true)
    setOrderError('')

    try {
      const { data: order, error: oErr } = await supabase
        .from('orders')
        .insert({
          store_id:        profile.store_id,
          cashier_id:      profile.id,
          status:          'completed',
          subtotal:        total,
          tax_amount:      0,
          discount_amount: 0,
          total,
          payment_method:  'cash',
          cash_received:   cashNum,
          change_amount:   change,
        })
        .select().single()

      if (oErr) {
        // Catch the DB trigger limit error
        if (oErr.message.includes('FREE_PLAN_ORDER_LIMIT')) {
          setOrderError('Daily limit of 100 transactions reached. Contact your system owner to upgrade to Pro.')
          setTodayCount(DAY_LIMIT)
        } else {
          setOrderError(oErr.message)
        }
        setProcessing(false)
        return
      }

      const { error: itemsErr } = await supabase.from('order_items').insert(
        cart.map(i => ({
          order_id:      order.id,
          store_id:      profile.store_id,
          product_id:    i.id,
          product_name:  i.name,
          product_price: i.price,
          quantity:      i.qty,
          subtotal:      i.price * i.qty,
        }))
      )

      if (itemsErr) {
        await supabase.from('orders').update({ status: 'voided' }).eq('id', order.id)
        setOrderError(itemsErr.message)
        setProcessing(false)
        return
      }

      await supabase.from('payments').insert({
        order_id: order.id,
        store_id: profile.store_id,
        amount:   total,
        method:   'cash',
        status:   'success',
      })

      // Update local stock
      setProducts(prev => prev.map(p => {
        const item = cart.find(i => i.id === p.id)
        return item ? { ...p, stock: p.stock - item.qty } : p
      }))

      setTodayCount(c => c + 1)
      setReceipt({
        order, cart: [...cart], total, cashNum, change,
        store: profile.stores,
      })
      setCart([])
      setCash('')

    } catch (err) {
      setOrderError(err.message)
    }
    setProcessing(false)
  }

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-4 flex-shrink-0">
        <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm">← Back</Link>
        <span className="font-bold">POS Terminal</span>
        <span className="text-xs text-gray-400">{profile?.stores?.name}</span>
        {plan === 'free' && (
          <span className="text-xs text-gray-500 ml-auto mr-2">
            Transaksi hari ini:
            <span className={`ml-1 font-bold ${todayCount >= DAY_LIMIT ? 'text-red-400' : todayCount >= 80 ? 'text-amber-400' : 'text-gray-300'}`}>
              {todayCount}/{DAY_LIMIT}
            </span>
          </span>
        )}
      </div>

      {/* Daily limit banner */}
      {limitHit && (
        <div className="bg-red-500/10 border-b border-red-500/30 text-red-400 px-4 py-2 text-sm text-center flex-shrink-0">
          ⛔ Daily transaction limit reached (100/day on Free plan). Resets at midnight.
          Contact your system owner to upgrade to Pro.
        </div>
      )}

      {/* Warning at 80% */}
      {!limitHit && plan === 'free' && todayCount >= 80 && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-400 px-4 py-2 text-sm text-center flex-shrink-0">
          ⚠️ Approaching daily limit — {DAY_LIMIT - todayCount} transactions remaining today.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* Products panel */}
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          <input
            type="text"
            placeholder="🔍 Cari produk atau scan barcode..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 mb-4 flex-shrink-0"
          />
          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 content-start">
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => !limitHit && addToCart(p)}
                disabled={p.stock === 0 || limitHit}
                className={`bg-gray-800 border rounded-xl overflow-hidden text-center transition-all ${
                  p.stock === 0 || limitHit
                    ? 'border-gray-700 opacity-40 cursor-not-allowed'
                    : 'border-gray-700 hover:border-violet-500 hover:scale-[1.02] active:scale-95'
                }`}
              >
                {/* Product image or emoji */}
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="w-full aspect-square object-cover"
                  />
                ) : (
                  <div className="w-full aspect-square bg-gray-700 flex items-center justify-center text-4xl">
                    {p.emoji}
                  </div>
                )}
                <div className="p-2">
                  <div className="text-sm font-bold leading-tight mb-0.5 truncate">{p.name}</div>
                  <div className="text-violet-400 font-bold text-sm">{formatRp(p.price)}</div>
                  <div className={`text-xs mt-0.5 ${
                    p.stock === 0 ? 'text-red-400'
                    : p.stock <= 5 ? 'text-amber-400'
                    : 'text-gray-500'
                  }`}>
                    {p.stock === 0 ? 'Habis' : p.stock <= 5 ? `Sisa ${p.stock}` : `${p.stock} tersedia`}
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-4 text-center text-gray-500 py-12">
                Produk tidak ditemukan
              </div>
            )}
          </div>
        </div>

        {/* Cart panel */}
        <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center flex-shrink-0">
            <span className="font-bold">Keranjang ({cart.reduce((s, i) => s + i.qty, 0)})</span>
            <button onClick={() => setCart([])} className="text-xs text-gray-400 hover:text-white">Kosongkan</button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            {cart.length === 0 && (
              <div className="text-center text-gray-500 py-12 text-sm">Ketuk produk untuk menambahkan</div>
            )}
            {cart.map(item => (
              <div key={item.id} className="flex items-center gap-2 py-2 border-b border-gray-800">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <span className="text-2xl flex-shrink-0">{item.emoji}</span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.name}</div>
                  <div className="text-xs text-gray-400">{formatRp(item.price)}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={() => updateQty(item.id, -1)}
                      className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-bold flex items-center justify-center">−</button>
                    <span className="text-sm font-bold w-6 text-center">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)}
                      className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-bold flex items-center justify-center">+</button>
                  </div>
                </div>
                <div className="text-sm font-bold flex-shrink-0">{formatRp(item.price * item.qty)}</div>
              </div>
            ))}
          </div>

          <div className="px-4 py-4 border-t border-gray-800 space-y-3 flex-shrink-0">
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span><span>{formatRp(total)}</span>
            </div>
            <input
              type="number"
              placeholder="Uang diterima (Rp)"
              value={cash}
              onChange={e => setCash(e.target.value)}
              disabled={limitHit}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500 font-bold disabled:opacity-40"
            />
            {cashNum > 0 && (
              <div className={`flex justify-between font-bold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                <span>Kembalian</span><span>{formatRp(change)}</span>
              </div>
            )}
            {orderError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-2 text-xs">
                {orderError}
              </div>
            )}
            <button
              onClick={completeSale}
              disabled={cart.length === 0 || cashNum < total || processing || limitHit}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors text-base"
            >
              {processing ? 'Memproses...' : limitHit ? '⛔ Limit Reached' : '✓ Selesaikan Transaksi'}
            </button>
          </div>
        </div>
      </div>

      {/* Receipt modal */}
      {receipt && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white text-gray-900 rounded-2xl p-6 w-full max-w-xs shadow-2xl max-h-[90vh] overflow-y-auto">
            <div id="receipt-print" style={{ fontFamily: "'Courier New', monospace", fontSize: '13px' }}>
              {/* Store header */}
              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{receipt.store?.name}</div>
                {receipt.store?.address && (
                  <div style={{ color: '#555', fontSize: '12px', marginTop: '2px' }}>{receipt.store.address}</div>
                )}
                {receipt.store?.phone && (
                  <div style={{ color: '#555', fontSize: '12px' }}>📞 {receipt.store.phone}</div>
                )}
                {receipt.store?.instagram && (
                  <div style={{ color: '#555', fontSize: '12px' }}>📸 {receipt.store.instagram}</div>
                )}
                <div style={{ color: '#888', fontSize: '11px', marginTop: '6px' }}>
                  {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {' · '}
                  {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ color: '#888', fontSize: '11px' }}>No. #{receipt.order.order_number}</div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px dashed #ccc', margin: '8px 0' }} />

              {/* Items */}
              {receipt.cart.map(i => (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div>
                    <div style={{ fontWeight: '600' }}>{i.name}</div>
                    <div style={{ color: '#888', fontSize: '11px' }}>{i.qty} × {formatRp(i.price)}</div>
                  </div>
                  <div style={{ fontWeight: 'bold' }}>{formatRp(i.price * i.qty)}</div>
                </div>
              ))}

              <hr style={{ border: 'none', borderTop: '1px dashed #ccc', margin: '8px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px' }}>
                <span>TOTAL</span><span>{formatRp(receipt.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span>Tunai</span><span>{formatRp(receipt.cashNum)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#16a34a' }}>
                <span>Kembalian</span><span>{formatRp(receipt.change)}</span>
              </div>

              <hr style={{ border: 'none', borderTop: '1px dashed #ccc', margin: '8px 0' }} />

              <div style={{ textAlign: 'center', color: '#888', fontSize: '11px' }}>
                {receipt.store?.receipt_footer || 'Terima kasih!'}
              </div>
            </div>

            <div className="flex gap-2 mt-4 no-print">
              <button onClick={() => setReceipt(null)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700">
                Tutup
              </button>
              <button onClick={() => window.print()}
                className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium">
                🖨️ Cetak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
