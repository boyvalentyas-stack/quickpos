import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

export default function POS() {
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [cash, setCash] = useState('')
  const [profile, setProfile] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [processing, setProcessing] = useState(false)
  const TAX = 0.10

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('users').select('*, stores(*)').eq('id', user.id).single()
      setProfile(prof)
      const { data: prods } = await supabase.from('products').select('*, categories(name)').eq('store_id', prof.store_id).eq('is_active', true).order('name')
      setProducts(prods || [])
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

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const tax = subtotal * TAX
  const total = subtotal + tax
  const cashNum = parseFloat(cash) || 0
  const change = cashNum - total

  async function completeSale() {
    if (cart.length === 0 || cashNum < total) return
    setProcessing(true)
    try {
      const { data: order, error: oErr } = await supabase.from('orders').insert({
        store_id: profile.store_id,
        cashier_id: profile.id,
        status: 'completed',
        subtotal, tax_amount: tax, discount_amount: 0, total,
        payment_method: 'cash',
        cash_received: cashNum,
        change_amount: change,
      }).select().single()

      if (oErr) throw oErr

      await supabase.from('order_items').insert(
        cart.map(i => ({
          order_id: order.id,
          store_id: profile.store_id,
          product_id: i.id,
          product_name: i.name,
          product_price: i.price,
          quantity: i.qty,
          subtotal: i.price * i.qty,
        }))
      )

      await supabase.from('payments').insert({
        order_id: order.id, store_id: profile.store_id,
        amount: total, method: 'cash', status: 'success',
      })

      setReceipt({ order, cart: [...cart], subtotal, tax, total, cashNum, change, store: profile.stores })
      setCart([])
      setCash('')
      setProducts(prev => prev.map(p => {
        const item = cart.find(i => i.id === p.id)
        return item ? { ...p, stock: p.stock - item.qty } : p
      }))
    } catch (err) {
      alert('Error: ' + err.message)
    }
    setProcessing(false)
  }

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-4">
        <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm">← Back</Link>
        <span className="font-bold">POS Terminal</span>
        <span className="text-xs text-gray-400">{profile?.stores?.name}</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Products */}
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          <input type="text" placeholder="🔍 Search products or scan barcode..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 mb-4" />
          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 content-start">
            {filtered.map(p => (
              <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock === 0}
                className={`bg-gray-800 border rounded-xl p-3 text-center transition-all ${p.stock === 0 ? 'border-gray-700 opacity-40 cursor-not-allowed' : 'border-gray-700 hover:border-violet-500 hover:scale-[1.02] active:scale-95'}`}>
                <div className="text-3xl mb-2">{p.emoji}</div>
                <div className="text-sm font-bold leading-tight mb-1">{p.name}</div>
                <div className="text-violet-400 font-bold">${p.price.toFixed(2)}</div>
                <div className={`text-xs mt-1 ${p.stock === 0 ? 'text-red-400' : p.stock <= 5 ? 'text-amber-400' : 'text-gray-500'}`}>
                  {p.stock === 0 ? 'Out of stock' : p.stock <= 5 ? `Only ${p.stock} left` : `${p.stock} in stock`}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cart */}
        <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
            <span className="font-bold">Cart ({cart.reduce((s,i)=>s+i.qty,0)} items)</span>
            <button onClick={() => setCart([])} className="text-xs text-gray-400 hover:text-white">Clear</button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {cart.length === 0 && (
              <div className="text-center text-gray-500 py-12 text-sm">Tap a product to add it</div>
            )}
            {cart.map(item => (
              <div key={item.id} className="flex items-center gap-2 py-2 border-b border-gray-800">
                <span className="text-xl">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.name}</div>
                  <div className="text-xs text-gray-400">${item.price.toFixed(2)} each</div>
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={() => updateQty(item.id,-1)} className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-bold flex items-center justify-center">−</button>
                    <span className="text-sm font-bold w-6 text-center">{item.qty}</span>
                    <button onClick={() => updateQty(item.id,1)} className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-bold flex items-center justify-center">+</button>
                  </div>
                </div>
                <div className="text-sm font-bold">${(item.price*item.qty).toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div className="px-4 py-4 border-t border-gray-800 space-y-2">
            <div className="flex justify-between text-sm text-gray-400"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm text-gray-400"><span>Tax (10%)</span><span>${tax.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-lg"><span>Total</span><span>${total.toFixed(2)}</span></div>
            <input type="number" placeholder="Cash received" value={cash} onChange={e => setCash(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500 text-lg font-bold" />
            {cashNum > 0 && (
              <div className={`flex justify-between font-bold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                <span>Change</span><span>${change.toFixed(2)}</span>
              </div>
            )}
            <button onClick={completeSale} disabled={cart.length===0 || cashNum<total || processing}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors">
              {processing ? 'Processing...' : '✓ Complete Sale'}
            </button>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white text-gray-900 rounded-2xl p-6 w-full max-w-xs shadow-2xl">
            <div className="text-center mb-4">
              <div className="font-bold text-lg">{receipt.store?.name}</div>
              {receipt.store?.address && <div className="text-sm text-gray-500">{receipt.store.address}</div>}
              <div className="text-sm text-gray-500 mt-1">Order #{receipt.order.order_number}</div>
              <div className="text-sm text-gray-500">{new Date().toLocaleString()}</div>
            </div>
            <hr className="border-dashed my-3" />
            {receipt.cart.map(i => (
              <div key={i.id} className="flex justify-between text-sm py-0.5">
                <span>{i.emoji} {i.name} ×{i.qty}</span>
                <span>${(i.price*i.qty).toFixed(2)}</span>
              </div>
            ))}
            <hr className="border-dashed my-3" />
            <div className="flex justify-between text-sm"><span>Tax</span><span>${receipt.tax.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-base mt-1"><span>Total</span><span>${receipt.total.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm mt-1"><span>Cash</span><span>${receipt.cashNum.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-green-600 mt-1"><span>Change</span><span>${receipt.change.toFixed(2)}</span></div>
            <hr className="border-dashed my-3" />
            <p className="text-center text-xs text-gray-400">{receipt.store?.receipt_footer}</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setReceipt(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-medium">Close</button>
              <button onClick={() => window.print()} className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium">🖨️ Print</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}