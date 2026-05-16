import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'
import LangToggle from '../components/LangToggle'

export default function Login() {
  const { t } = useLang()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false) }
    else window.location.href = '/quickpos/#/dashboard'
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Lang toggle top right */}
        <div className="flex justify-end mb-4">
          <LangToggle />
        </div>

        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏪</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{t.welcomeBack}</h1>
        </div>

        <form onSubmit={handleSubmit}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm">{error}</div>
          )}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">{t.emailAddress}</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-violet-500 transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">{t.password}</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-violet-500 transition-colors" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-base">
            {loading ? t.signingIn : t.signIn}
          </button>
          <p className="text-center text-gray-500 text-sm">
            {t.noAccount}{' '}
            <Link to="/signup" className="text-violet-400 hover:underline">{t.createStore}</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
