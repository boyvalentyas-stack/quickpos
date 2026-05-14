import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

export default function Signup() {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', storeName: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function setField(field) {
    return (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authErr } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (authErr) {
      setError(authErr.message)
      setLoading(false)
      return
    }

    const { error: setupErr } = await supabase.rpc('handle_new_user_signup', {
      p_user_id:    data.user.id,
      p_email:      form.email,
      p_full_name:  form.fullName,
      p_store_name: form.storeName,
    })

    if (setupErr) {
      setError(setupErr.message)
      setLoading(false)
      return
    }

    window.location.href = '/quickpos/#/dashboard'
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏪</div>
          <h1 className="text-3xl font-bold text-white">Create your store</h1>
          <p className="text-gray-400 mt-2">Free forever. No credit card needed.</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">Store Name</label>
            <input type="text" required placeholder="e.g. Sunrise Café"
              value={form.storeName} onChange={setField('storeName')}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">Your Full Name</label>
            <input type="text" required placeholder="John Smith"
              value={form.fullName} onChange={setField('fullName')}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">Email Address</label>
            <input type="email" required placeholder="john@example.com"
              value={form.email} onChange={setField('email')}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-widest mb-2">Password</label>
            <input type="password" required placeholder="Minimum 6 characters" minLength={6}
              value={form.password} onChange={setField('password')}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-lg">
            {loading ? 'Creating your store...' : '🚀 Create Store & Sign Up'}
          </button>
          <p className="text-center text-gray-500 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-violet-400 hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}