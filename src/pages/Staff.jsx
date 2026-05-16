import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'
import LangToggle from '../components/LangToggle'

const FREE_CASHIER_LIMIT = 2
const EDGE_FN_URL = 'https://fcqkipluxqdejqqthazd.supabase.co/functions/v1/invite-cashier'

export default function Staff() {
  const { t } = useLang()
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
      .from('users').select('store_id, role, stores(plan)').eq('id', user.id).single()
    setStoreId(prof.store_id)
    setMyRole(prof.role)
    setPlan(prof.stores?.plan || 'free')
    const { data } = await supabase.from('users').select('*')
      .eq('store_id', prof.store_id).order('created_at')
    setStaff(data || [])
  }

  async function inviteCashier(e) {
    e.preventDefault()
    if (atLimit) return
    setSaving(true); setError(''); setSuccess('')

    const { data: { session } } = await supabase.auth.getSession()

    let res, result
    try {
      res = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({ email: form.email, password: form.password, name: form.name, storeId }),
      })
      result = await res.json()
    } catch (fetchErr) {
      setError('Network error: ' + fetchErr.message)
      setSaving(false)
      return
    }

    if (!res.ok) {
      setError(result.error || 'Failed to add cashier.')
    } else {
      setSuccess(`✅ ${form.name} ${t.addedSuccess}`)
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

  async function reactivateCashier(userId) {
    if (atLimit) { setError(t.cashierLimitReached); return }
    await supabase.from('users').update({ is_active: true }).eq('id', userId)
    setStaff(s => s.map(x => x.id === userId ? { ...x, is_active: true } : x))
  }

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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm flex-shrink-0">{t.back}</Link>
        <h1 className="font-bold truncate">{t.staffManagement}</h1>
        <span className="text-xs text-gray-500 flex-shrink-0">
          {cashierCount}/{plan === 'free' ? FREE_CASHIER_LIMIT : '∞'} {t.cashiers}
        </span>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <LangToggle />
          <button onClick={() => { if (!atLimit) { setShowForm(true); setError(''); setSuccess('') } }}
            disabled={atLimit}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors whitespace-nowrap">
            {t.addCashier}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {atLimit && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl p-4 text-sm">
            <strong>{t.cashierLimitReached}</strong> {t.freePlanCashiers} {t.contactOwner}
          </div>
        )}
        {error   && <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-4 text-sm">{error}</div>}
        {success && <div className="bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl p-4 text-sm">{success}</div>}

        {showForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
            <h2 className="font-bold text-lg mb-1">{t.addCashierTitle}</h2>
            <p className="text-gray-400 text-sm mb-4">{t.addCashierDesc}</p>
            <form onSubmit={inviteCashier} className="space-y-4">
              {[
                { label: t.fullName,      field: 'name',     type: 'text',     placeholder: 'e.g. Sarah Lee' },
                { label: t.emailAddress,  field: 'email',    type: 'email',    placeholder: 'cashier@example.com' },
                { label: t.loginPassword, field: 'password', type: 'password', placeholder: t.minPassword },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field}>
                  <label className="block text-xs text-gray-400 uppercase tracking-widest mb-1.5">{label}</label>
                  <input type={type} required placeholder={placeholder}
                    value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors" />
                </div>
              ))}
              <p className="text-xs text-gray-500">{t.passwordHint}</p>
              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-6 py-2.5 rounded-xl font-bold transition-colors text-sm">
                  {saving ? t.adding : t.addCashierTitle}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setError('') }}
                  className="bg-gray-800 hover:bg-gray-700 px-6 py-2.5 rounded-xl text-sm transition-colors">
                  {t.cancel}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Staff list */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-bold">{t.yourTeam}</h2>
          </div>
          {staff.map(member => {
            const isMe = member.email === myEmail
            return (
              <div key={member.id}
                className={`flex items-center gap-3 px-4 py-3 border-b border-gray-800 last:border-0 ${!member.is_active ? 'opacity-50' : ''}`}>
                <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {member.full_name?.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-sm truncate">{member.full_name}</span>
                    {isMe && <span className="text-xs text-gray-500">({t.you})</span>}
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${member.role === 'owner' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {member.role}
                    </span>
                    {!member.is_active && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-gray-500/20 text-gray-400">{t.inactive}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">{member.email}</div>
                </div>

                {/* Actions — only for non-owner, non-self */}
                {member.role !== 'owner' && !isMe && (
                  member.is_active
                    ? <button onClick={() => removeCashier(member.id, member.full_name)}
                        className="text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0">
                        {t.remove}
                      </button>
                    : <button onClick={() => reactivateCashier(member.id)} disabled={atLimit}
                        className="text-xs text-green-400 bg-green-500/10 hover:bg-green-500/20 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0 disabled:opacity-40">
                        {t.reactivate}
                      </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Permissions info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-400 space-y-1">
          <p className="font-medium text-gray-300 mb-2">{t.cashierPerms}</p>
          {[t.canDashboard, t.canPOS, t.cannotProducts, t.cannotSettings, t.cannotPassword].map(line => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
    </div>
  )
}
