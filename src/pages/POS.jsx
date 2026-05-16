import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'
import LangToggle from '../components/LangToggle'

function formatRp(amount) {
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID')
}

// ─────────────────────────────────────────────────────────────
// CartPanel is a TRUE top-level component (not defined inside POS).
// This is the root cause fix: when a function is defined INSIDE
// another component, React treats it as a brand-new component
// every render, unmounts the old one, mounts a new one —
// destroying focus and cursor position on every keystroke.
// Defined at module level, it is stable across renders.
// ─────────────────────────────────────────────────────────────
function CartPanel({
  t, cart, itemCount, total, cashNum, change, canPay,
  payMethod, onSetPayMethod, limitHit, processing, orderError,
  onUpdateQty, onClearCart, onCompleteSale,
  cashInputRef, onCashInput,
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center flex-shrink-0">
        <span className="font-bold">{t.cart} ({itemCount})</span>
        <button onClick={onClearCart} className="text-xs text-gray-400 hover:text-white">
          {t.clearCart}
        </button>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {cart.length === 0 && (
          <div className="text-center text-gray-500 py-10 text-sm">{t.addToCartHint}</div>
        )}
        {cart.map(item => (
          <div key={item.id} className="flex items-center gap-2 py-2 border-b border-gray-800">
            {item.image_url
              ? <img src={item.image_url} alt={item.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
              : <span className="text-xl flex-shrink-0">{item.emoji}</span>}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{item.name}</div>
              <div className="text-xs text-gray-400">{formatRp(item.price)}</div>
              <div className="flex items-center gap-2 mt-1">
                <button onClick={() => onUpdateQty(item.id, -1)}
                  className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-bold flex items-center justify-center">−</button>
                <span className="text-sm font-bold w-5 text-center">{item.qty}</span>
                <button onClick={() => onUpdateQty(item.id, 1)}
                  className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-bold flex items-center justify-center">+</button>
              </div>
            </div>
            <div className="text-sm font-bold flex-shrink-0">{formatRp(item.price * item.qty)}</div>
          </div>
        ))}
      </div>

      {/* Footer: totals + payment */}
      <div className="px-4 py-4 border-t border-gray-800 space-y-3 flex-shrink-0">
        <div className="flex justify-between font-bold text-lg">
          <span>{t.total}</span>
          <span>{formatRp(total)}</span>
        </div>

        {/* Payment method toggle */}
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-widest mb-2">{t.paymentMethod}</div>
          <div className="flex gap-2">
            {[
              { val: 'cash', label: t.cash, icon: '💵' },
              { val: 'qris', label: t.qris, icon: '📱' },
            ].map(({ val, label, icon }) => (
              <button key={val} onClick={() => onSetPayMethod(val)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-sm font-bold transition-colors ${
                  payMethod === val
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                }`}>
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        {/* Cash input — uncontrolled, driven by ref only */}
        {payMethod === 'cash' && (
          <>
            <input
              ref={cashInputRef}
              type="text"
              inputMode="numeric"
              placeholder={t.cashReceived}
              disabled={limitHit}
              onInput={onCashInput}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-violet-500 font-bold text-base disabled:opacity-40"
            />
            {cashNum > 0 && (
              <div className={`flex justify-between font-bold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                <span>{t.change}</span>
                <span>{formatRp(change)}</span>
              </div>
            )}
          </>
        )}

        {/* QRIS amount display */}
        {payMethod === 'qris' && cart.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-400 mb-1">QRIS Amount</div>
            <div className="text-violet-400 font-bold text-lg">{formatRp(total)}</div>
          </div>
        )}

        {orderError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-2 text-xs">
            {orderError}
          </div>
        )}

        <button onClick={onCompleteSale} disabled={!canPay}
          className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors text-base">
          {processing ? t.processing : limitHit ? t.limitReached : t.completeTransaction}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main POS page
// ─────────────────────────────────────────────────────────────
export default function POS() {
  const { t } = useLang()
  const [products,   setProducts]   = useState([])
  const [cart,       setCart]       = useState([])
  const [search,     setSearch]     = useState('')
  const [cashNum,    setCashNum]    = useState(0)
  const [payMethod,  setPayMethod]  = useState('cash')
  const [profile,    setProfile]    = useState(null)
  const [receipt,    setReceipt]    = useState(null)
  const [processing, setProcessing] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [todayCount, setTodayCount] = useState(0)
  const [plan,       setPlan]       = useState('free')
  const [showCart,   setShowCart]   = useState(false)

  const cashInputRef = useRef(null)
  const DAY_LIMIT    = 100
  const limitHit     = plan === 'free' && todayCount >= DAY_LIMIT

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase
        .from('users').select('*, stores(*)').eq('id', user.id).single()
      setProfile(prof)
      setPlan(prof.stores?.plan || 'free')
      const { data: prods } = await supabase
        .from('products').select('*, categories(name)')
        .eq('store_id', prof.store_id).eq('is_active', true).order('name')
      setProducts(prods || [])
      const today = new Date().toISOString().split('T')[0]
      const { count } = await supabase.from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', prof.store_id).neq('status', 'voided')
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
    if (product.stock === 0 || limitHit) return
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id)
      if (ex) {
        if (ex.qty >= product.stock) return prev
        return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, { ...product, qty: 1 }]
    })
  }

  // useCallback keeps these stable — CartPanel won't see new function
  // references on every POS render, preventing unnecessary re-renders
  const updateQty = useCallback((id, delta) => {
    setCart(prev =>
      prev.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i)
          .filter(i => i.qty > 0)
    )
  }, [])

  const clearCart = useCallback(() => setCart([]), [])

  // Raw DOM event handler — no React state write happens during keystroke,
  // only after, so the browser never loses cursor position
  const handleCashInput = useCallback((e) => {
    const digits = e.target.value.replace(/\D/g, '')
    e.target.value = digits  // strip non-digits directly in DOM
    setCashNum(digits === '' ? 0 : parseInt(digits, 10))
  }, [])

  function handleSetPayMethod(val) {
    setPayMethod(val)
    setCashNum(0)
    if (cashInputRef.current) cashInputRef.current.value = ''
  }

  const total     = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const change    = cashNum - total
  const itemCount = cart.reduce((s, i) => s + i.qty, 0)
  const canPay    = cart.length > 0 && !processing && !limitHit &&
    (payMethod === 'qris' || cashNum >= total)

  async function completeSale() {
    if (!canPay) return
    setProcessing(true)
    setOrderError('')

    try {
      const { data: order, error: oErr } = await supabase.from('orders').insert({
        store_id:        profile.store_id,
        cashier_id:      profile.id,
        status:          'completed',
        subtotal:        total,
        tax_amount:      0,
        discount_amount: 0,
        total,
        payment_method:  payMethod,
        cash_received:   payMethod === 'cash' ? cashNum : total,
        change_amount:   payMethod === 'cash' ? change : 0,
      }).select().single()

      if (oErr) {
        if (oErr.message.includes('FREE_PLAN_ORDER_LIMIT')) {
          setOrderError(t.dailyLimitBanner)
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
        method:   payMethod,
        status:   'success',
      })

      setProducts(prev => prev.map(p => {
        const item = cart.find(i => i.id === p.id)
        return item ? { ...p, stock: p.stock - item.qty } : p
      }))

      setTodayCount(c => c + 1)
      setReceipt({ order, cart: [...cart], total, cashNum, change, payMethod, store: profile.stores })
      setCart([])
      setCashNum(0)
      if (cashInputRef.current) cashInputRef.current.value = ''
      setShowCart(false)

    } catch (err) {
      setOrderError(err.message)
    }
    setProcessing(false)
  }

  // Single props object passed to both desktop and mobile CartPanel instances
  const cartProps = {
    t, cart, itemCount, total, cashNum, change, canPay,
    payMethod, onSetPayMethod: handleSetPayMethod,
    limitHit, processing, orderError,
    onUpdateQty: updateQty,
    onClearCart: clearCart,
    onCompleteSale: completeSale,
    cashInputRef,
    onCashInput: handleCashInput,
  }

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">

      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm flex-shrink-0">{t.back}</Link>
        <span className="font-bold text-sm sm:text-base truncate">{profile?.stores?.name}</span>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {plan === 'free' && (
            <span className={`text-xs hidden sm:inline ${
              todayCount >= DAY_LIMIT ? 'text-red-400'
              : todayCount >= 80 ? 'text-amber-400'
              : 'text-gray-500'
            }`}>
              {t.transactionsToday} <strong>{todayCount}/{DAY_LIMIT}</strong>
            </span>
          )}
          <LangToggle />
          <button onClick={() => setShowCart(true)}
            className="sm:hidden relative bg-violet-600 hover:bg-violet-500 px-3 py-2 rounded-lg text-sm font-bold">
            🛒
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Limit banners */}
      {limitHit && (
        <div className="bg-red-500/10 border-b border-red-500/30 text-red-400 px-4 py-2 text-xs sm:text-sm text-center flex-shrink-0">
          {t.dailyLimitBanner}
        </div>
      )}
      {!limitHit && plan === 'free' && todayCount >= 80 && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-400 px-4 py-2 text-xs sm:text-sm text-center flex-shrink-0">
          {t.approachingLimit} {DAY_LIMIT - todayCount} {t.remaining}
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Products grid */}
        <div className="flex-1 flex flex-col overflow-hidden p-3 sm:p-4">
          <input type="text" placeholder={t.searchPlaceholder} value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 mb-3 text-sm flex-shrink-0"
          />
          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 content-start">
            {filtered.map(p => (
              <button key={p.id} onClick={() => addToCart(p)}
                disabled={p.stock === 0 || limitHit}
                className={`bg-gray-800 border rounded-xl overflow-hidden text-center transition-all ${
                  p.stock === 0 || limitHit
                    ? 'border-gray-700 opacity-40 cursor-not-allowed'
                    : 'border-gray-700 hover:border-violet-500 active:scale-95'
                }`}>
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} className="w-full aspect-square object-cover" />
                  : <div className="w-full aspect-square bg-gray-700 flex items-center justify-center text-3xl sm:text-4xl">{p.emoji}</div>
                }
                <div className="p-2">
                  <div className="text-xs sm:text-sm font-bold leading-tight mb-0.5 truncate">{p.name}</div>
                  <div className="text-violet-400 font-bold text-xs sm:text-sm">{formatRp(p.price)}</div>
                  <div className={`text-xs mt-0.5 ${
                    p.stock === 0 ? 'text-red-400'
                    : p.stock <= 5 ? 'text-amber-400'
                    : 'text-gray-500'
                  }`}>
                    {p.stock === 0 ? t.outOfStock
                      : p.stock <= 5 ? `${t.lowStock} ${p.stock} ${t.left}`
                      : `${p.stock} ${t.available}`}
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-2 sm:col-span-3 lg:col-span-4 text-center text-gray-500 py-12 text-sm">
                {t.noProducts}
              </div>
            )}
          </div>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden sm:flex w-72 lg:w-80 bg-gray-900 border-l border-gray-800 flex-col flex-shrink-0">
          <CartPanel {...cartProps} />
        </div>
      </div>

      {/* Mobile cart drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCart(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl flex flex-col"
            style={{ maxHeight: '85vh' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
              <span className="font-bold">{t.cart}</span>
              <button onClick={() => setShowCart(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-hidden">
              <CartPanel {...cartProps} />
            </div>
          </div>
        </div>
      )}

      {/* Receipt modal */}
      {receipt && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white text-gray-900 rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-xs shadow-2xl max-h-[90vh] overflow-y-auto">
            <div id="receipt-print" style={{ fontFamily: "'Courier New', monospace", fontSize: '13px' }}>
              <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{receipt.store?.name}</div>
                {receipt.store?.address   && <div style={{ color: '#555', fontSize: '12px' }}>{receipt.store.address}</div>}
                {receipt.store?.phone     && <div style={{ color: '#555', fontSize: '12px' }}>📞 {receipt.store.phone}</div>}
                {receipt.store?.instagram && <div style={{ color: '#555', fontSize: '12px' }}>📸 {receipt.store.instagram}</div>}
                <div style={{ color: '#888', fontSize: '11px', marginTop: '6px' }}>
                  {new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })}
                  {' · '}{new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' })}
                </div>
                <div style={{ color: '#888', fontSize: '11px' }}>No. #{receipt.order.order_number}</div>
                <div style={{ color: '#555', fontSize: '11px', marginTop: '2px' }}>
                  {receipt.payMethod === 'qris' ? '📱 QRIS' : '💵 Tunai'}
                </div>
              </div>
              <hr style={{ border: 'none', borderTop: '1px dashed #ccc', margin: '8px 0' }} />
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
              {receipt.payMethod === 'cash' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <span>Tunai</span><span>{formatRp(receipt.cashNum)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#16a34a' }}>
                    <span>Kembalian</span><span>{formatRp(receipt.change)}</span>
                  </div>
                </>
              )}
              {receipt.payMethod === 'qris' && (
                <div style={{ textAlign: 'center', color: '#7c3aed', fontWeight: 'bold', marginTop: '4px', fontSize: '12px' }}>
                  ✓ Dibayar via QRIS
                </div>
              )}
              <hr style={{ border: 'none', borderTop: '1px dashed #ccc', margin: '8px 0' }} />
              <div style={{ textAlign: 'center', color: '#888', fontSize: '11px' }}>
                {receipt.store?.receipt_footer || 'Terima kasih!'}
              </div>
            </div>
            <div className="flex gap-2 mt-4 no-print">
              <button onClick={() => setReceipt(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700">
                {t.close}
              </button>
              <button onClick={() => window.print()}
                className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium">
                {t.print}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
