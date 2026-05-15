import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

const FREE_LIMIT = 30

// ── Image processing ────────────────────────────────────────
// Resizes the uploaded file to 400x400, crops to square (center),
// converts to JPEG, and ensures the result is under 1MB.
function processImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width  = 400
        canvas.height = 400

        // Center-crop to square first
        const size = Math.min(img.width, img.height)
        const sx   = (img.width  - size) / 2
        const sy   = (img.height - size) / 2

        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, 400, 400)
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 400, 400)

        // Try progressively lower quality until under 1MB
        let quality = 0.85
        let blob = null
        const tryEncode = () => {
          canvas.toBlob(
            (b) => {
              if (!b) { reject(new Error('Failed to process image')); return }
              if (b.size > 1_000_000 && quality > 0.3) {
                quality -= 0.1
                tryEncode()
              } else {
                resolve(b)
              }
            },
            'image/jpeg',
            quality
          )
        }
        tryEncode()
      }
      img.onerror = () => reject(new Error('Invalid image file'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

export default function Products() {
  const [products,   setProducts]   = useState([])
  const [categories, setCategories] = useState([])
  const [storeId,    setStoreId]    = useState(null)
  const [plan,       setPlan]       = useState('free')
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  const [form, setForm] = useState({
    name: '', price: '', stock: '', category_id: '', sku: '', emoji: '📦'
  })
  const [imageFile,    setImageFile]    = useState(null)   // processed Blob
  const [imagePreview, setImagePreview] = useState(null)   // data URL for preview
  const [imageLoading, setImageLoading] = useState(false)
  const fileInputRef = useRef(null)

  const activeCount = products.filter(p => p.is_active).length
  const atLimit     = plan === 'free' && activeCount >= FREE_LIMIT

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase
        .from('users').select('store_id, role, stores(plan)')
        .eq('id', user.id).single()

      setStoreId(prof.store_id)
      setPlan(prof.stores?.plan || 'free')

      const { data: prods } = await supabase
        .from('products')
        .select('*, categories(name)')
        .eq('store_id', prof.store_id)
        .order('name')
      setProducts(prods || [])

      const { data: cats } = await supabase
        .from('categories').select('*')
        .eq('store_id', prof.store_id)
      setCategories(cats || [])
    }
    load()
  }, [])

  // ── Handle file selection ───────────────────────────────
  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, WEBP).')
      return
    }

    setImageLoading(true)
    setError('')
    try {
      const processed = await processImage(file)
      setImageFile(processed)
      // Preview
      const reader = new FileReader()
      reader.onload = (ev) => setImagePreview(ev.target.result)
      reader.readAsDataURL(processed)
    } catch (err) {
      setError('Image processing failed: ' + err.message)
    }
    setImageLoading(false)
    // Clear input so same file can be re-selected if needed
    e.target.value = ''
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
  }

  // ── Save product ────────────────────────────────────────
  async function saveProduct(e) {
    e.preventDefault()
    if (atLimit) return
    setSaving(true)
    setError('')

    let image_url = null

    // 1. Upload processed image if present
    if (imageFile) {
      const fileName = `${storeId}/${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('product-images')
        .upload(fileName, imageFile, { contentType: 'image/jpeg', upsert: false })

      if (upErr) {
        setError('Image upload failed: ' + upErr.message)
        setSaving(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName)
      image_url = urlData.publicUrl
    }

    // 2. Insert product row
    const { data, error: dbErr } = await supabase
      .from('products')
      .insert({
        store_id:    storeId,
        name:        form.name,
        price:       parseFloat(form.price),
        stock:       parseInt(form.stock),
        category_id: form.category_id || null,
        sku:         form.sku || null,
        emoji:       form.emoji || '📦',
        image_url,
      })
      .select('*, categories(name)')
      .single()

    if (dbErr) {
      // Parse friendly error from DB trigger
      if (dbErr.message.includes('FREE_PLAN_PRODUCT_LIMIT')) {
        setError('Free plan limit reached (30 products). Upgrade to Pro to add more.')
      } else {
        setError(dbErr.message)
      }
      // Clean up uploaded image if DB insert failed
      if (image_url) {
        const path = image_url.split('/product-images/')[1]
        await supabase.storage.from('product-images').remove([path])
      }
    } else {
      setProducts(p => [...p, data])
      setForm({ name: '', price: '', stock: '', category_id: '', sku: '', emoji: '📦' })
      setImageFile(null)
      setImagePreview(null)
      setShowForm(false)
    }
    setSaving(false)
  }

  // ── Delete / deactivate product ─────────────────────────
  async function deleteProduct(id, imageUrl) {
    if (!window.confirm('Remove this product?')) return
    await supabase.from('products').update({ is_active: false }).eq('id', id)
    // Remove image from storage
    if (imageUrl) {
      const path = imageUrl.split('/product-images/')[1]
      if (path) await supabase.storage.from('product-images').remove([path])
    }
    setProducts(p => p.filter(x => x.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm">← Dashboard</Link>
        <h1 className="font-bold text-lg">Products</h1>
        <span className="text-xs text-gray-500 ml-1">
          {activeCount}/{plan === 'free' ? FREE_LIMIT : '∞'} used
          {plan === 'free' && (
            <span className="ml-2 px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-md text-xs font-bold">FREE</span>
          )}
          {plan === 'pro' && (
            <span className="ml-2 px-2 py-0.5 bg-violet-500/20 text-violet-400 rounded-md text-xs font-bold">PRO</span>
          )}
        </span>
        <button
          onClick={() => { if (!atLimit) setShowForm(true) }}
          disabled={atLimit}
          title={atLimit ? 'Upgrade to Pro to add more products' : ''}
          className="ml-auto bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-bold transition-colors"
        >
          + Add Product
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Free plan limit warning */}
        {atLimit && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl p-4 text-sm">
            <strong>Free plan limit reached.</strong> You've used all 30 product slots.
            Contact the system owner to upgrade your store to Pro for unlimited products.
          </div>
        )}

        {/* Add product form */}
        {showForm && (
          <form onSubmit={saveProduct}
            className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="font-bold text-lg mb-4">New Product</h2>

            {error && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Image upload */}
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">
                  Product Image <span className="text-gray-600">(auto-resized to 400×400px, max 1MB)</span>
                </label>
                <div className="flex items-start gap-4">
                  {/* Preview box */}
                  <div
                    onClick={() => !imageLoading && fileInputRef.current?.click()}
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-700 hover:border-violet-500 flex items-center justify-center cursor-pointer overflow-hidden transition-colors flex-shrink-0 bg-gray-800"
                  >
                    {imageLoading ? (
                      <span className="text-xs text-gray-400">Processing...</span>
                    ) : imagePreview ? (
                      <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <div className="text-2xl mb-1">📷</div>
                        <div className="text-xs text-gray-500">Click to upload</div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 pt-1">
                    <button type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={imageLoading}
                      className="bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                      {imagePreview ? 'Change Image' : 'Select Image'}
                    </button>
                    {imagePreview && (
                      <button type="button" onClick={removeImage}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                        Remove
                      </button>
                    )}
                    <span className="text-xs text-gray-600">JPG, PNG, WEBP</span>
                    {imageFile && (
                      <span className="text-xs text-green-500">
                        ✓ {(imageFile.size / 1024).toFixed(0)} KB
                      </span>
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Text fields */}
              {[
                { label: 'Product Name', field: 'name',  type: 'text',   required: true,  placeholder: 'e.g. Caramel Latte', span: 2 },
                { label: 'Emoji Icon',   field: 'emoji', type: 'text',   required: false, placeholder: '☕', span: 1 },
                { label: 'SKU / Barcode',field: 'sku',   type: 'text',   required: false, placeholder: 'BEV001', span: 1 },
                { label: 'Price (Rp)',   field: 'price', type: 'number', required: true,  placeholder: '25000', span: 1 },
                { label: 'Stock',        field: 'stock', type: 'number', required: true,  placeholder: '50', span: 1 },
              ].map(({ label, field, type, required, placeholder, span }) => (
                <div key={field} className={span === 2 ? 'col-span-2' : ''}>
                  <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1.5">{label}</label>
                  <input
                    type={type} required={required} placeholder={placeholder}
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
              ))}

              {/* Category */}
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1.5">Category</label>
                <select value={form.category_id}
                  onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500">
                  <option value="">No category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button type="submit" disabled={saving || imageLoading}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-6 py-2.5 rounded-xl font-bold transition-colors">
                {saving ? 'Saving...' : 'Save Product'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setError(''); removeImage() }}
                className="bg-gray-800 hover:bg-gray-700 px-6 py-2.5 rounded-xl transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Products table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {['Image', 'Product', 'Category', 'Price', 'Stock', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-widest font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.filter(p => p.is_active).map(p => (
                <tr key={p.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name}
                        className="w-10 h-10 rounded-lg object-cover border border-gray-700" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-xl">
                        {p.emoji}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{p.categories?.name || '—'}</td>
                  <td className="px-4 py-3 text-sm font-bold">
                    Rp {Math.round(p.price).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                      p.stock === 0 ? 'bg-red-500/20 text-red-400'
                      : p.stock <= p.low_stock_threshold ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-green-500/20 text-green-400'}`}>
                      {p.stock === 0 ? 'Habis' : p.stock + ' unit'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-green-500/20 text-green-400">Active</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteProduct(p.id, p.image_url)}
                      className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1 rounded-lg transition-colors">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {products.filter(p => p.is_active).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    No products yet. Add your first one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
