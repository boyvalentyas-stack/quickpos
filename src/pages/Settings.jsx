import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

export default function Settings() {
  const [storeId, setStoreId] = useState(null)
  const [store, setStore] = useState({
    name: '', address: '', phone: '', instagram: '', receipt_footer: ''
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase
        .from('users').select('store_id, stores(*)').eq('id', user.id).single()
      setStoreId(prof.store_id)
      const s = prof.stores
      setStore({
        name:            s.name            || '',
        address:         s.address         || '',
        phone:           s.phone           || '',
        instagram:       s.instagram       || '',
        receipt_footer:  s.receipt_footer  || '',
      })
    }
    load()
  }, [])

  async function saveStore(e) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg('')
    const { error } = await supabase
      .from('stores')
      .update({
        name:           store.name,
        address:        store.address,
        phone:          store.phone,
        instagram:      store.instagram,
        receipt_footer: store.receipt_footer,
      })
      .eq('id', storeId)
    setSaveMsg(error ? '❌ ' + error.message : '✅ Store details saved!')
    setSaving(false)
  }

  async function changePassword(e) {
    e.preventDefault()
    setPwMsg('')
    setPwError('')

    if (pwForm.next !== pwForm.confirm) {
      setPwError('New passwords do not match.')
      return
    }
    if (pwForm.next.length < 6) {
      setPwError('Password must be at least 6 characters.')
      return
    }

    setPwLoading(true)

    // Verify current password by attempting a sign-in
    const { data: { user } } = await supabase.auth.getUser()
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: pwForm.current,
    })

    if (signInErr) {
      setPwError('Current password is incorrect.')
      setPwLoading(false)
      return
    }

    // Update to new password
    const { error: updateErr } = await supabase.auth.updateUser({
      password: pwForm.next
    })

    if (updateErr) {
      setPwError('❌ ' + updateErr.message)
    } else {
      setPwMsg('✅ Password changed successfully!')
      setPwForm({ current: '', next: '', confirm: '' })
    }
    setPwLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm">← Dashboard</Link>
        <h1 className="font-bold text-lg">Settings</h1>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

        {/* Store Details */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-bold text-lg mb-1">🏪 Store Details</h2>
          <p className="text-gray-400 text-sm mb-5">This information will appear on every printed receipt.</p>
          <form onSubmit={saveStore} className="space-y-4">
            {[
              { label: 'Store Name',        field: 'name',            placeholder: 'Sunrise Café',           type: 'text' },
              { label: 'Address',           field: 'address',         placeholder: 'Jl. Sudirman No.1, Jakarta', type: 'text' },
              { label: 'Phone Number',      field: 'phone',           placeholder: '0812-3456-7890',         type: 'text' },
              { label: 'Instagram',         field: 'instagram',       placeholder: '@sunrisecafe',           type: 'text' },
              { label: 'Receipt Footer',    field: 'receipt_footer',  placeholder: 'Terima kasih sudah berkunjung!', type: 'text' },
            ].map(({ label, field, placeholder, type }) => (
              <div key={field}>
                <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1.5">{label}</label>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={store[field]}
                  onChange={e => setStore(s => ({ ...s, [field]: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            ))}
            {saveMsg && (
              <div className={`text-sm p-3 rounded-lg ${saveMsg.startsWith('✅') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {saveMsg}
              </div>
            )}
            <button type="submit" disabled={saving}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl transition-colors">
              {saving ? 'Saving...' : 'Save Store Details'}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-bold text-lg mb-1">🔒 Change Password</h2>
          <p className="text-gray-400 text-sm mb-5">
            Change your account password. You'll need to enter your current password first.
          </p>
          <form onSubmit={changePassword} className="space-y-4">
            {[
              { label: 'Current Password', field: 'current', placeholder: 'Your current password' },
              { label: 'New Password',     field: 'next',    placeholder: 'At least 6 characters' },
              { label: 'Confirm New Password', field: 'confirm', placeholder: 'Type new password again' },
            ].map(({ label, field, placeholder }) => (
              <div key={field}>
                <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1.5">{label}</label>
                <input
                  type="password"
                  placeholder={placeholder}
                  value={pwForm[field]}
                  onChange={e => setPwForm(f => ({ ...f, [field]: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            ))}
            {pwError && <div className="bg-red-500/10 text-red-400 text-sm p-3 rounded-lg">{pwError}</div>}
            {pwMsg   && <div className="bg-green-500/10 text-green-400 text-sm p-3 rounded-lg">{pwMsg}</div>}
            <button type="submit" disabled={pwLoading}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl transition-colors">
              {pwLoading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}