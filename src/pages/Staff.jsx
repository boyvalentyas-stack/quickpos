import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

const FREE_CASHIER_LIMIT = 2

export default function Staff() {
  const [staff,    setStaff]    = useState([])
  const [storeId,  setStoreId]  = useState(null)
  const [plan,     setPlan]     = useState('free')
  const [myRole,   setMyRole]   = useState(null)
  const [myEmail,  setMyEmail]  = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ name: '', email: '', password: '' })
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  const cashierCount = staff.filter(s => s.role !== 'owner' && s.is_active).length
  const atLimit      = plan === 'free' && cashierCount >= FREE_CASHIER_LIMIT

  useEffect(() => { loadStaff() }, [])

  async function loadStaff() {
    const { data: { user } } = await supabase.auth.getUser()
    setMyEmail(user.email)

    const { data: prof } = await supabase
      .from('users')
      .select('store_id, role, stores(plan)')
      .eq('id', user.id).single()

    setStoreId(prof.store_id)
    setMyRole(prof.role)
    setPlan(prof.stores?.plan || 'free')

    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('store_id', prof.store_id)
      .order('created_at')
    setStaff(data || [])
  }

  async function inviteCashier(e) {
    e.preventDefault()
    if (atLimit) return
    setSaving(true)
    setError('')
    setSuccess('')

    // Call our backend API route which uses the service role key
    // to create the auth user, then inserts the profile
    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch(`https://fcqkipluxqdejqqthazd.supabase.co/functions/v1/invite-cashier`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session.access_token,
      },
      body: JSON.stringify({
        email:    form.email,
        password: form.password,
        name:     form.name,
        storeId,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      setError(result.error || 'Failed to add cashier.')
    } else {
      setSuccess(`✅ ${form.name} has been added and will receive a login email.`)
      setForm({ name: '', email: '', password: '' })
      setShowForm(false)
      await loadStaff()
    }
    setSaving(false)
  }

  async function removeCashier(userId, name) {
    if (!window.confirm(`Remove ${name} from your store?`)) return
    await supabase.from('users').update({ is_active: false }).eq('id', userId)
    setStaff(s => s.map(x => x.id === userId ? { ...x, is_active: false } : x))
  }

  async function reactivateCashier(userId, name) {
    if (atLimit) {
      setError('Cashier limit reached. Remove another cashier first.')
      return
    }
    await supabase.from('users').update({ is_active: true }).eq('id', userId)
    setStaff(s => s.map(x => x.id === userId ? { ...x, is_active: true } : x))
  }

  if (myRole !== 'owner') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <div className="text-lg font-bold">Owner access only</div>
          <Link to="/dashboard" className="text-violet-400 text-sm hover:underline mt-2 block">← Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm">← Dashboard</Link>
        <h1 className="font-bold text-lg">Staff Management</h1>
        <span className="text-xs text-gray-500">
          {cashierCount}/{plan === 'free' ? FREE_CASHIER_LIMIT : '∞'} cashiers
        </span>
        <button
          onClick={() => { if (!atLimit) { setShowForm(true); setError(''); setSuccess('') } }}
          disabled={atLimit}
          className="ml-auto bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-bold transition-colors"
        >
          + Add Cashier
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">

        {/* Limit warning */}
        {atLimit && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl p-4 text-sm">
            <strong>Cashier limit reached.</strong> Free plan allows up to {FREE_CASHIER_LIMIT} cashier accounts.
            Contact the system owner to upgrade to Pro for unlimited staff.
          </div>
        )}

        {error   && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-sm">{error}</div>}
        {success && <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl p-4 text-sm">{success}</div>}

        {/* Invite form */}
        {showForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="font-bold text-lg mb-1">Add Cashier / Admin</h2>
            <p className="text-gray-400 text-sm mb-4">
              They'll receive an email notification and can log in immediately with the password you set.
              They can only access the Dashboard and POS — not Settings or Products.
            </p>
            <form onSubmit={inviteCashier} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1.5">Full Name</label>
                <input type="text" required placeholder="e.g. Sarah Lee"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1.5">Email Address</label>
                <input type="email" required placeholder="cashier@example.com"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1.5">Login Password</label>
                <input type="password" required minLength={6} placeholder="Minimum 6 characters"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors" />
                <p className="text-xs text-gray-500 mt-1">
                  Share this password with your cashier. They cannot change it themselves.
                </p>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-6 py-2.5 rounded-xl font-bold transition-colors">
                  {saving ? 'Adding...' : 'Add Cashier'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setError('') }}
                  className="bg-gray-800 hover:bg-gray-700 px-6 py-2.5 rounded-xl transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Staff list */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h2 className="font-bold">Your Team</h2>
          </div>
          {staff.map(member => {
            const isMe = member.email === myEmail
            return (
              <div key={member.id}
                className={`flex items-center gap-4 px-5 py-4 border-b border-gray-800 last:border-0 ${!member.is_active ? 'opacity-50' : ''}`}>
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {member.full_name?.slice(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{member.full_name}</span>
                    {isMe && <span className="text-xs text-gray-500">(you)</span>}
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                      member.role === 'owner'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-blue-500/20 text-blue-400'}`}>
                      {member.role}
                    </span>
                    {!member.is_active && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-gray-500/20 text-gray-400">
                        inactive
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{member.email}</div>
                </div>

                {/* Actions — only for Non-Owner, Non-Self */}
                {member.role !== 'owner' && !isMe && (
                  <div>
                    {member.is_active ? (
                      <button
                        onClick={() => removeCashier(member.id, member.full_name)}
                        className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-colors">
                        Remove
                      </button>
                    ) : (
                      <button
                        onClick={() => reactivateCashier(member.id, member.full_name)}
                        disabled={atLimit}
                        className="text-xs text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40">
                        Reactivate
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Info box */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-sm text-gray-400 space-y-1">
          <p className="font-medium text-gray-300 mb-2">ℹ️ Cashier access permissions</p>
          <p>✅ Can view Dashboard</p>
          <p>✅ Can operate POS Terminal</p>
          <p>❌ Cannot edit Products or Stock</p>
          <p>❌ Cannot change Store Settings</p>
          <p>❌ Cannot change their own password</p>
        </div>
      </div>
    </div>
  )
}
