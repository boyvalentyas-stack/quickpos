import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'
import LangToggle from '../components/LangToggle'

const FREE_LIMIT = 30

function processImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 400; canvas.height = 400
        const size = Math.min(img.width, img.height)
        const sx = (img.width - size) / 2, sy = (img.height - size) / 2
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 400, 400)
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 400, 400)
        let quality = 0.85
        const tryEncode = () => canvas.toBlob(b => {
          if (!b) { reject(new Error('Failed')); return }
          if (b.size > 1_000_000 && quality > 0.3) { quality -= 0.1; tryEncode() }
          else resolve(b)
        }, 'image/jpeg', quality)
        tryEncode()
      }
      img.onerror = () => reject(new Error('Invalid image'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Read failed'))
    reader.readAsDataURL(file)
  })
}

const emptyForm = { name: '', price: '', stock: '', category_id: '', sku: '', emoji: '📦' }

export default function Products() {
  const { t } = useLang()
  const [products,   setProducts]   = useState([])
  const [categories, setCategories] = useState([])
  const [storeId,    setStoreId]    = useState(null)
  const [plan,       setPlan]       = useState('free')
  const [showForm,   setShowForm]   = useState(false)
  const [editingId,  setEditingId]  = useState(null) // null = add mode, id = edit mode
  const [form,       setForm]       = useState(emptyForm)
  const [imageFile,  setImageFile]  = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [existingImageUrl, setExistingImageUrl] = useState(null)
  const [imageLoading, setImageLoading] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const fileInputRef = useRef(null)

  const activeCount = products.filter(p => p.is_active).length
  const atLimit     = plan === 'free' && activeCount >= FREE_LIMIT

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase
      .from('users').select('store_id, stores(plan)').eq('id', user.id).single()
    setStoreId(prof.store_id)
    setPlan(prof.stores?.plan || 'free')
    const { data: prods } = await supabase.from('products')
      .select('*, categories(name)').eq('store_id', prof.store_id)
      .eq('is_active', true).order('name')
    setProducts(prods || [])
    const { data: cats } = await supabase.from('categories')
      .select('*').eq('store_id', prof.store_id)
    setCategories(cats || [])
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return }
    setImageLoading(true); setError('')
    try {
      const processed = await processImage(file)
      setImageFile(processed)
      const reader = new FileReader()
      reader.onload = ev => setImagePreview(ev.target.result)
      reader.readAsDataURL(processed)
    } catch (err) { setError('Image processing failed: ' + err.message) }
    setImageLoading(false)
    e.target.value = ''
  }

  function openAddForm() {
    setEditingId(null); setForm(emptyForm)
    setImageFile(null); setImagePreview(null); setExistingImageUrl(null)
    setError(''); setShowForm(true)
  }

  function openEditForm(p) {
    setEditingId(p.id)
    setForm({ name: p.name, price: p.price, stock: p.stock, category_id: p.category_id || '', sku: p.sku || '', emoji: p.emoji || '📦' })
    setImageFile(null)
    setImagePreview(null)
    setExistingImageUrl(p.image_url || null)
    setError(''); setShowForm(true)
  }

  function closeForm() {
    setShowForm(false); setEditingId(null); setError('')
    setImageFile(null); setImagePreview(null); setExistingImageUrl(null)
  }

  async function saveProduct(e) {
    e.preventDefault()
    if (!editingId && atLimit) return
    setSaving(true); setError('')

    let image_url = existingImageUrl // keep existing by default

    if (imageFile) {
      // Upload new image
      const fileName = `${storeId}/${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('product-images').upload(fileName, imageFile, { contentType: 'image/jpeg' })
      if (upErr) { setError('Image upload failed: ' + upErr.message); setSaving(false); return }
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName)
      image_url = urlData.publicUrl

      // Delete old image from storage if replacing
      if (existingImageUrl) {
        const oldPath = existingImageUrl.split('/product-images/')[1]
        if (oldPath) await supabase.storage.from('product-images').remove([oldPath])
      }
    }

    const payload = {
      name:        form.name,
      price:       parseFloat(form.price),
      stock:       parseInt(form.stock),
      category_id: form.category_id || null,
      sku:         form.sku || null,
      emoji:       form.emoji || '📦',
      image_url,
    }

    if (editingId) {
      // UPDATE
      const { data, error: dbErr } = await supabase.from('products')
        .update(payload).eq('id', editingId).select('*, categories(name)').single()
      if (dbErr) { setError(dbErr.message) }
      else { setProducts(prev => prev.map(p => p.id === editingId ? data : p)); closeForm() }
    } else {
      // INSERT
      const { data, error: dbErr } = await supabase.from('products')
        .insert({ ...payload, store_id: storeId }).select('*, categories(name)').single()
      if (dbErr) {
        if (dbErr.message.includes('FREE_PLAN_PRODUCT_LIMIT'))
          setError(t.freeLimitWarning + ' ' + t.contactUpgrade)
        else setError(dbErr.message)
        if (image_url && !existingImageUrl) {
          const path = image_url.split('/product-images/')[1]
          await supabase.storage.from('product-images').remove([path])
        }
      } else { setProducts(p => [...p, data]); closeForm() }
    }
    setSaving(false)
  }

  async function deleteProduct(id, imageUrl) {
    if (!window.confirm('Remove this product?')) return
    await supabase.from('products').update({ is_active: false }).eq('id', id)
    if (imageUrl) {
      const path = imageUrl.split('/product-images/')[1]
      if (path) await supabase.storage.from('product-images').remove([path])
    }
    setProducts(p => p.filter(x => x.id !== id))
  }

  // ── Shared image upload UI ──
  const ImageUpload = () => (
    <div className="col-span-2">
      <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">
        {t.productImage} <span className="text-gray-600 normal-case">{t.imageHint}</span>
      </label>
      <div className="flex items-start gap-4">
        <div onClick={() => !imageLoading && fileInputRef.current?.click()}
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 border-dashed border-gray-700 hover:border-violet-500 flex items-center justify-center cursor-pointer overflow-hidden transition-colors flex-shrink-0 bg-gray-800">
          {imageLoading ? <span className="text-xs text-gray-400">...</span>
            : (imagePreview || existingImageUrl)
              ? <img src={imagePreview || existingImageUrl} alt="preview" className="w-full h-full object-cover" />
              : <div className="text-center"><div className="text-2xl mb-1">📷</div><div className="text-xs text-gray-500">{t.clickToUpload}</div></div>
          }
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={imageLoading}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
            {(imagePreview || existingImageUrl) ? t.changeImage : t.selectImage}
          </button>
          {(imagePreview || existingImageUrl) && (
            <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); setExistingImageUrl(null) }}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
              {t.remove}
            </button>
          )}
          {imageFile && <span className="text-xs text-green-500">✓ {(imageFile.size / 1024).toFixed(0)} KB</span>}
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm flex-shrink-0">{t.back}</Link>
        <h1 className="font-bold truncate">{t.products}</h1>
        <span className="text-xs text-gray-500 flex-shrink-0">
          {activeCount}/{plan === 'free' ? FREE_LIMIT : '∞'}
          {plan === 'free' && <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs font-bold">FREE</span>}
          {plan === 'pro'  && <span className="ml-1.5 px-1.5 py-0.5 bg-violet-500/20 text-violet-400 rounded text-xs font-bold">PRO</span>}
        </span>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <LangToggle />
          <button onClick={openAddForm} disabled={atLimit}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap">
            {t.addProduct}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5">
        {atLimit && (
          <div className="mb-4 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl p-4 text-sm">
            <strong>{t.freeLimitWarning}</strong> {t.contactUpgrade}
          </div>
        )}

        {/* Add / Edit form */}
        {showForm && (
          <form onSubmit={saveProduct} className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6 mb-5">
            <h2 className="font-bold text-lg mb-4">{editingId ? t.editProduct : t.newProduct}</h2>
            {error && <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm">{error}</div>}

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <ImageUpload />

              {[
                { label: t.productName, field: 'name',  type: 'text',   required: true,  placeholder: 'e.g. Caramel Latte', span: 2 },
                { label: t.emojiIcon,   field: 'emoji', type: 'text',   required: false, placeholder: '☕', span: 1 },
                { label: t.skuBarcode,  field: 'sku',   type: 'text',   required: false, placeholder: 'BEV001', span: 1 },
                { label: t.price,       field: 'price', type: 'number', required: true,  placeholder: '25000', span: 1 },
                { label: t.stock,       field: 'stock', type: 'number', required: true,  placeholder: '50', span: 1 },
              ].map(({ label, field, type, required, placeholder, span }) => (
                <div key={field} className={span === 2 ? 'col-span-2' : ''}>
                  <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1.5">{label}</label>
                  <input type={type} required={required} placeholder={placeholder}
                    value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 sm:px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors text-sm" />
                </div>
              ))}

              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1.5">{t.category}</label>
                <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 sm:px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 text-sm">
                  <option value="">{t.noCategory}</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button type="submit" disabled={saving || imageLoading}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-5 py-2.5 rounded-xl font-bold transition-colors text-sm">
                {saving ? t.saving : editingId ? t.saveChanges : t.saving.replace('...', '') + 'Save'}
              </button>
              <button type="button" onClick={closeForm}
                className="bg-gray-800 hover:bg-gray-700 px-5 py-2.5 rounded-xl text-sm transition-colors">
                {t.cancel}
              </button>
            </div>
          </form>
        )}

        {/* Products — card grid on mobile, table on desktop */}
        <div className="hidden sm:block bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {['', t.productName, t.category, t.price, t.stock, t.status, ''].map((h, i) => (
                  <th key={i} className="text-left px-4 py-3 text-xs text-gray-400 uppercase tracking-widest font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    {p.image_url
                      ? <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover border border-gray-700" />
                      : <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-xl">{p.emoji}</div>
                    }
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{p.categories?.name || '—'}</td>
                  <td className="px-4 py-3 text-sm font-bold">Rp {Math.round(p.price).toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                      p.stock === 0 ? 'bg-red-500/20 text-red-400'
                      : p.stock <= p.low_stock_threshold ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-green-500/20 text-green-400'}`}>
                      {p.stock === 0 ? t.outOfStockLabel : `${p.stock} ${t.units}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-green-500/20 text-green-400">{t.active}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEditForm(p)}
                        className="text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1 rounded-lg transition-colors">
                        {t.edit}
                      </button>
                      <button onClick={() => deleteProduct(p.id, p.image_url)}
                        className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1 rounded-lg transition-colors">
                        {t.remove}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500 text-sm">No products yet. Add your first one above.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="sm:hidden space-y-3">
          {products.map(p => (
            <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex gap-3">
              {p.image_url
                ? <img src={p.image_url} alt={p.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                : <div className="w-14 h-14 rounded-xl bg-gray-800 flex items-center justify-center text-2xl flex-shrink-0">{p.emoji}</div>
              }
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{p.name}</div>
                <div className="text-violet-400 text-sm font-bold">Rp {Math.round(p.price).toLocaleString('id-ID')}</div>
                <div className={`text-xs mt-0.5 ${p.stock === 0 ? 'text-red-400' : p.stock <= p.low_stock_threshold ? 'text-amber-400' : 'text-gray-400'}`}>
                  {p.stock === 0 ? t.outOfStockLabel : `${p.stock} ${t.units}`}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button onClick={() => openEditForm(p)}
                  className="text-xs text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg">
                  {t.edit}
                </button>
                <button onClick={() => deleteProduct(p.id, p.image_url)}
                  className="text-xs text-red-400 bg-red-500/10 px-2.5 py-1 rounded-lg">
                  {t.remove}
                </button>
              </div>
            </div>
          ))}
          {products.length === 0 && (
            <div className="text-center text-gray-500 py-12 text-sm">No products yet.</div>
          )}
        </div>
      </div>
    </div>
  )
}
