import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, KeyRound, UserRound } from 'lucide-react'
import { useAuth } from '../context/authContext'
import { USE_DJANGO_API } from '../services/api'

function TeamLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  if (isAuthenticated) {
    return <Navigate to="/team" replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMessage('')
    setSubmitting(true)

    try {
      await login({ username: username.trim(), password })
      navigate(location.state?.from || '/team', { replace: true })
    } catch (error) {
      setErrorMessage(error.message || 'Unable to sign in right now.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#0f2542]">
      <div className="relative min-h-screen bg-gradient-to-br from-[#102848] via-[#17365d] to-[#214672]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-yellow/18 blur-3xl" />
          <div className="absolute left-[6%] top-[32%] h-80 w-80 rounded-full bg-sky-300/12 blur-3xl" />
          <div className="absolute right-[10%] bottom-[-6%] h-80 w-80 rounded-full bg-white/8 blur-3xl" />
        </div>

        <section className="container-shell relative flex min-h-screen items-center py-8">
          <div className="grid w-full items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="relative z-10 max-w-xl px-2 text-white">
              <Link
                to="/"
                className="inline-flex items-center transition-transform duration-300 hover:scale-105"
              >
                <img
                  src="/Logo_image.png"
                  alt="Bilta logo"
                  className="h-12 w-auto object-contain sm:h-14"
                />
              </Link>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-yellow">
                Bilta Internal
              </p>
              <h1 className="mt-6 max-w-lg text-4xl font-extrabold leading-tight text-white sm:text-5xl">
                Sign in to your Team CMS workspace.
              </h1>
              <p className="mt-5 max-w-md text-base leading-7 text-white/78">
                Access staff operations, records, reports, and protected business tools from one
                secure Bilta login.
              </p>
            </div>

            <div className="relative z-10 mx-auto w-full max-w-md">
              <div className="border-t-4 border-yellow bg-white px-6 py-8 shadow-[0_30px_90px_rgba(19,27,67,0.34)] sm:px-8 sm:py-10">
                <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Team Access
                </p>

                <div className="mt-3">
                  <h2 className="text-2xl font-extrabold text-navy">Welcome back</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Sign in with your staff or owner account to continue.
                  </p>
                </div>

                {!USE_DJANGO_API ? (
                  <div className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    CMS login needs the Django API connection to be enabled first.
                  </div>
                ) : null}

                {errorMessage ? (
                  <div className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </div>
                ) : null}

                <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-slate-600">Username</span>
                    <div className="relative">
                      <UserRound
                        size={16}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-yellow focus:ring-4 focus:ring-yellow/20"
                        autoComplete="username"
                        placeholder="Enter your username"
                        required
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-slate-600">Password</span>
                    <div className="relative">
                      <KeyRound
                        size={16}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-yellow focus:ring-4 focus:ring-yellow/20"
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        required
                      />
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting || !USE_DJANGO_API}
                    className="inline-flex w-full items-center justify-center gap-2 bg-yellow px-4 py-3 text-sm font-bold text-navy transition hover:bg-yellow-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Signing In...' : 'Sign In'}
                    <ArrowRight size={16} />
                  </button>
                </form>

                <div className="mt-10 flex items-center justify-between gap-3 text-[11px] text-slate-400">
                  <Link to="/" className="font-semibold text-navy transition hover:text-navy-dark">
                    Main Website
                  </Link>
                  <p>Bilta Internal Access</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default TeamLoginPage
