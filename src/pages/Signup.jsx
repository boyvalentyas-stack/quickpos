import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'
import LangToggle from '../components/LangToggle'

export default function Signup() {
  const { t } = useLang()
  const [form,    setForm]    = useState({ fullName: '', email: '', password: '', storeName: '' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  function setField(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authErr } = await supabase.auth.signUp({
      email: form.email, password: form.password,
    })
    if (authErr) { setError(authErr.message); setLoading(false); return }

    const { error: setupErr } = await supabase.rpc('handle_new_user_signup', {
      p_user_id:    data.user.id,
      p_email:      form.email,
      p_full_name:  form.fullName,
      p_store_name: form.storeName,
    })
    if (setupErr) { setError(setupErr.message); setLoading(false); return }

    window.location.href = '/quickpos/#/dashboard'
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <LangToggle />
        </div>

        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏪</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{t.createStore}</h1>
          <p className="text-gray-400 mt-2 text-sm">{t.freeForever}</p>
        </div>

        <form onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm">{error}</div>
          )}
          {[
            { label: t.storeName,  field: 'storeName', type: 'text',     placeholder: 'e.g. Sunrise Café' },
            { label: t.yourName,   field: 'fullName',  type: 'text',     placeholder: 'John Smith' },
            { label: t.emailAddress, field: 'email',   type: 'email',    placeholder: 'john@example.com' },
            { label: t.password,   field: 'password',  type: 'password', placeholder: t.minPassword },
          ].map(({ label, field, type, placeholder }) => (
            <div key={field}>
              <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">{label}</label>
              <input type={type} required placeholder={placeholder}
                value={form[field]} onChange={setField(field)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors" />
            </div>
          ))}
          <button type="submit" disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-base">
            {loading ? t.creatingStore : t.createStoreBtn}
          </button>
          <p className="text-center text-gray-500 text-sm">
            {t.alreadyHaveAccount}{' '}
            <Link to="/login" className="text-violet-400 hover:underline">{t.signIn}</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
