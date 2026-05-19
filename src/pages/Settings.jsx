import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'
import LangToggle from '../components/LangToggle'

export default function Settings() {
  const { t } = useLang()
  const [storeId,  setStoreId]  = useState(null)
  const [myRole,   setMyRole]   = useState(null)
  const [store,    setStore]    = useState({
    name:'', address:'', phone:'', instagram:'', receipt_footer:'', store_code:'', qris_image_url:''
  })
  const [saving,   setSaving]   = useState(false)
  const [saveMsg,  setSaveMsg]  = useState('')
  const [pwForm,   setPwForm]   = useState({ current:'', next:'', confirm:'' })
  const [pwMsg,    setPwMsg]    = useState('')
  const [pwError,  setPwError]  = useState('')
  const [pwLoad,   setPwLoad]   = useState(false)

  // QRIS upload state
  const [qrisFile,    setQrisFile]    = useState(null)
  const [qrisPreview, setQrisPreview] = useState(null)
  const [qrisLoading, setQrisLoading] = useState(false)
  const [qrisMsg,     setQrisMsg]     = useState('')
  const qrisInputRef = useRef(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase
        .from('users').select('store_id, role, stores(*)').eq('id', user.id).single()
      setStoreId(prof.store_id)
      setMyRole(prof.role)
      const s = prof.stores
      setStore({
        name:           s?.name           || '',
        address:        s?.address        || '',
        phone:          s?.phone          || '',
        instagram:      s?.instagram      || '',
        receipt_footer: s?.receipt_footer || '',
        store_code:     s?.store_code     || '',
        qris_image_url: s?.qris_image_url || '',
      })
    }
    load()
  }, [])

  if (myRole && myRole !== 'owner') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <div className="text-lg font-bold">{t.ownerOnly}</div>
          <Link to="/dashboard" className="text-violet-400 text-sm hover:underline mt-2 block">{t.back}</Link>
        </div>
      </div>
    )
  }

  async function saveStore(e) {
    e.preventDefault()
    setSaving(true); setSaveMsg('')
    const { error } = await supabase.from('stores').update({
      name: store.name, address: store.address, phone: store.phone,
      instagram: store.instagram, receipt_footer: store.receipt_footer,
    }).eq('id', storeId)
    setSaveMsg(error ? '❌ ' + error.message : '✅ Store details saved!')
    setSaving(false)
    setTimeout(() => setSaveMsg(''), 3000)
  }

  async function changePassword(e) {
    e.preventDefault()
    setPwMsg(''); setPwError('')
    if (pwForm.next !== pwForm.confirm) { setPwError('New passwords do not match.'); return }
    if (pwForm.next.length < 6) { setPwError('Password must be at least 6 characters.'); return }
    setPwLoad(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: pwForm.current })
    if (signInErr) { setPwError('Current password is incorrect.'); setPwLoad(false); return }
    const { error: updateErr } = await supabase.auth.updateUser({ password: pwForm.next })
    if (updateErr) setPwError('❌ ' + updateErr.message)
    else { setPwMsg('✅ Password changed successfully!'); setPwForm({ current:'', next:'', confirm:'' }) }
    setPwLoad(false)
  }

  // ── QRIS image upload ─────────────────────────────────────
  async function handleQrisFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setQrisMsg('❌ Please select an image file.'); return }
    setQrisFile(file)
    const reader = new FileReader()
    reader.onload = ev => setQrisPreview(ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function saveQris() {
    if (!qrisFile) return
    setQrisLoading(true); setQrisMsg('')

    const fileName = `${storeId}/qris.${qrisFile.name.split('.').pop()}`

    // Delete old file first if exists
    if (store.qris_image_url) {
      const oldPath = store.qris_image_url.split('/qris-images/')[1]
      if (oldPath) await supabase.storage.from('qris-images').remove([oldPath])
    }

    const { error: upErr } = await supabase.storage
      .from('qris-images')
      .upload(fileName, qrisFile, { contentType: qrisFile.type, upsert: true })

    if (upErr) { setQrisMsg('❌ Upload failed: ' + upErr.message); setQrisLoading(false); return }

    const { data: urlData } = supabase.storage.from('qris-images').getPublicUrl(fileName)
    const url = urlData.publicUrl

    const { error: dbErr } = await supabase.from('stores')
      .update({ qris_image_url: url }).eq('id', storeId)

    if (dbErr) { setQrisMsg('❌ ' + dbErr.message) }
    else {
      setStore(s => ({ ...s, qris_image_url: url }))
      setQrisFile(null)
      setQrisPreview(null)
      setQrisMsg('✅ QRIS image saved! It will show on the POS when QRIS is selected.')
    }
    setQrisLoading(false)
  }

  async function removeQris() {
    if (!window.confirm('Remove your QRIS image?')) return
    setQrisLoading(true)
    if (store.qris_image_url) {
      const path = store.qris_image_url.split('/qris-images/')[1]
      if (path) await supabase.storage.from('qris-images').remove([path])
    }
    await supabase.from('stores').update({ qris_image_url: null }).eq('id', storeId)
    setStore(s => ({ ...s, qris_image_url: '' }))
    setQrisPreview(null)
    setQrisFile(null)
    setQrisMsg('QRIS image removed.')
    setQrisLoading(false)
  }

  const currentQrisImage = qrisPreview || store.qris_image_url || null

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm flex-shrink-0">{t.back}</Link>
        <h1 className="font-bold">{t.settings}</h1>
        <div className="ml-auto"><LangToggle /></div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-6">

        {/* Store Code */}
        {store.store_code && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
            <h2 className="font-bold text-lg mb-1"># {t.storeCode}</h2>
            <p className="text-gray-400 text-sm mb-3">{t.storeCodeDesc}</p>
            <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="font-mono font-bold text-2xl text-violet-400 tracking-widest">
                {store.store_code}
              </span>
              <span className="text-xs text-gray-500 ml-auto">read-only</span>
            </div>
          </div>
        )}

        {/* Store Details */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
          <h2 className="font-bold text-lg mb-1">{t.storeDetails}</h2>
          <p className="text-gray-400 text-sm mb-4">{t.storeDetailsDesc}</p>
          <form onSubmit={saveStore} className="space-y-4">
            {[
              { label: t.storeName,     field: 'name',           placeholder: 'Sunrise Café' },
              { label: t.address,       field: 'address',        placeholder: 'Jl. Sudirman No.1, Jakarta' },
              { label: t.phone,         field: 'phone',          placeholder: '0812-3456-7890' },
              { label: t.instagram,     field: 'instagram',      placeholder: '@sunrisecafe' },
              { label: t.receiptFooter, field: 'receipt_footer', placeholder: 'Terima kasih sudah berkunjung!' },
            ].map(({ label, field, placeholder }) => (
              <div key={field}>
                <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1.5">{label}</label>
                <input type="text" placeholder={placeholder} value={store[field]}
                  onChange={e => setStore(s => ({ ...s, [field]: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors" />
              </div>
            ))}
            {saveMsg && (
              <div className={`text-sm p-3 rounded-lg ${saveMsg.startsWith('✅') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {saveMsg}
              </div>
            )}
            <button type="submit" disabled={saving}
              className="w-full sm:w-auto bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition-colors">
              {saving ? t.saving : t.saveStoreDetails}
            </button>
          </form>
        </div>

        {/* QRIS Image */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
          <h2 className="font-bold text-lg mb-1">📱 QRIS Payment Image</h2>
          <p className="text-gray-400 text-sm mb-4">
            Upload your store's QRIS image from your bank or e-wallet (GoPay, OVO, Dana, BCA, etc.).
            It will be displayed full-screen on the POS when a cashier selects QRIS payment,
            so customers can scan it directly from the screen.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* Preview */}
            <div
              onClick={() => !qrisLoading && qrisInputRef.current?.click()}
              className={`w-full sm:w-48 h-48 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors cursor-pointer flex-shrink-0 ${
                currentQrisImage
                  ? 'border-violet-500 bg-gray-800'
                  : 'border-gray-700 hover:border-violet-500 bg-gray-800'
              }`}
            >
              {currentQrisImage ? (
                <img src={currentQrisImage} alt="QRIS" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="text-center px-4">
                  <div className="text-4xl mb-2">📱</div>
                  <div className="text-xs text-gray-500">Click to upload your QRIS image</div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 flex-1">
              <div className="text-sm text-gray-400">
                {store.qris_image_url
                  ? '✅ QRIS image is set and active on your POS.'
                  : '⚠️ No QRIS image uploaded yet. Add one so cashiers can show it during payment.'}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => qrisInputRef.current?.click()}
                  disabled={qrisLoading}
                  className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                  {store.qris_image_url ? 'Replace Image' : 'Upload QRIS Image'}
                </button>
                {(qrisFile || store.qris_image_url) && (
                  <>
                    {qrisFile && (
                      <button
                        type="button"
                        onClick={saveQris}
                        disabled={qrisLoading}
                        className="bg-green-700 hover:bg-green-600 disabled:opacity-50 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                        {qrisLoading ? 'Saving...' : '✓ Save QRIS Image'}
                      </button>
                    )}
                    {store.qris_image_url && !qrisFile && (
                      <button
                        type="button"
                        onClick={removeQris}
                        disabled={qrisLoading}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                        Remove
                      </button>
                    )}
                  </>
                )}
              </div>

              {qrisMsg && (
                <div className={`text-sm p-3 rounded-lg ${
                  qrisMsg.startsWith('✅') ? 'bg-green-500/10 text-green-400'
                  : qrisMsg.startsWith('❌') ? 'bg-red-500/10 text-red-400'
                  : 'bg-gray-800 text-gray-400'
                }`}>
                  {qrisMsg}
                </div>
              )}

              <p className="text-xs text-gray-600">
                Supported formats: JPG, PNG, WEBP. Recommended: use the official QRIS image your bank provided.
              </p>
            </div>
          </div>

          <input
            ref={qrisInputRef}
            type="file"
            accept="image/*"
            onChange={handleQrisFile}
            className="hidden"
          />
        </div>

        {/* Change Password */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
          <h2 className="font-bold text-lg mb-1">{t.changePassword}</h2>
          <p className="text-gray-400 text-sm mb-4">{t.changePasswordDesc}</p>
          <form onSubmit={changePassword} className="space-y-4">
            {[
              { label: t.currentPassword,    field: 'current', placeholder: '••••••••' },
              { label: t.newPassword,        field: 'next',    placeholder: t.minPassword },
              { label: t.confirmNewPassword, field: 'confirm', placeholder: t.minPassword },
            ].map(({ label, field, placeholder }) => (
              <div key={field}>
                <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1.5">{label}</label>
                <input type="password" placeholder={placeholder}
                  value={pwForm[field]}
                  onChange={e => setPwForm(f => ({ ...f, [field]: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors" />
              </div>
            ))}
            {pwError && <div className="bg-red-500/10 text-red-400 text-sm p-3 rounded-lg">{pwError}</div>}
            {pwMsg   && <div className="bg-green-500/10 text-green-400 text-sm p-3 rounded-lg">{pwMsg}</div>}
            <button type="submit" disabled={pwLoad}
              className="w-full sm:w-auto bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition-colors">
              {pwLoad ? t.changingPassword : t.changePasswordBtn}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
