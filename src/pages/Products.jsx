import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

export default function Products() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [storeId, setStoreId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name:'', price:'', stock:'', category_id:'', sku:'', emoji:'📦' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('users').select('store_id').eq('id', user.id).single()
      setStoreId(prof.store_id)
      const { data: prods } = await supabase.from('products').select('*, categories(name)').eq('store_id', prof.store_id).order('name')
      setProducts(prods || [])
      const { data: cats } = await supabase.from('categories').select('*').eq('store_id', prof.store_id)
      setCategories(cats || [])
    }
    load()
  }, [])

  async function saveProduct(e) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase.from('products').insert({
      store_id: storeId,
      name: form.name,
      price: parseFloat(form.price),
      stock: parseInt(form.stock),
      category_id: form.category_id || null,
      sku: form.sku || null,
      emoji: form.emoji || '📦',
    }).select('*, categories(name)').single()
    if (!error) {
      setProducts(p => [...p, data])
      setForm({ name:'', price:'', stock:'', category_id:'', sku:'', emoji:'📦' })
      setShowForm(false)
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm">← Dashboard</Link>
        <h1 className="font-bold text-lg">Products</h1>
        <button onClick={() => setShowForm(true)} className="ml-auto bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
          + Add Product
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {showForm && (
          <form onSubmit={saveProduct} className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 grid grid-cols-2 gap-4">
            <h2 className="col-span-2 font-bold text-lg">New Product</h2>
            {[
              { label:'Product Name', field:'name', type:'text', required:true },
              { label:'Emoji Icon', field:'emoji', type:'text' },
              { label:'Price (Rp. )', field:'price', type:'number', required:true },
              { label:'Stock Quantity', field:'stock', type:'number', required:true },
              { label:'SKU / Barcode', field:'sku', type:'text' },
            ].map(({ label, field, type, required }) => (
              <div key={field}>
                <label className="block text-xs text-gray-400 uppercase mb-1">{label}</label>
                <input type={type} required={required} value={form[field]}
                  onChange={e => setForm(f => ({...f, [field]: e.target.value}))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500" />
              </div>
            ))}
            <div>
              <label className="block text-xs text-gray-400 uppercase mb-1">Category</label>
              <select value={form.category_id} onChange={e => setForm(f => ({...f, category_id: e.target.value}))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-500">
                <option value="">No category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div className="col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="bg-violet-600 hover:bg-violet-500 px-6 py-2 rounded-lg font-bold disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Product'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="bg-gray-800 hover:bg-gray-700 px-6 py-2 rounded-lg">Cancel</button>
            </div>
          </form>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {['Product', 'Category', 'Price', 'Stock', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-widest font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-sm font-medium">{p.emoji} {p.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{p.categories?.name || '—'}</td>
                  <td className="px-4 py-3 text-sm font-bold">Rp. {p.price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${p.stock === 0 ? 'bg-red-500/20 text-red-400' : p.stock <= p.low_stock_threshold ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`}>
                      {p.stock === 0 ? 'Out of stock' : p.stock + ' units'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${p.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">No products yet. Add your first one above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}