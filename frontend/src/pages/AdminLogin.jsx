import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api'

export default function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      const res = await login(password)
      if (res.message === 'Logged in') {
        onLogin()
        navigate('/admin')
      } else {
        setError(res.message || 'Invalid password')
      }
    } catch {
      setError('Login failed')
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16">
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Admin Login</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-stone-800
            focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
          autoFocus
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-white
            hover:bg-stone-700 transition-colors"
        >
          Log in
        </button>
      </form>
    </div>
  )
}
