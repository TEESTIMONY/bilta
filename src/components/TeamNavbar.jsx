import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/authContext'

const teamLinks = [
  { label: 'Desk', to: '/team' },
  { label: 'Records', to: '/team/records' },
  { label: 'Reports', to: '/team/reports', ownerOnly: true },
  { label: 'Settings', to: '/team/settings', ownerOnly: true },
  { label: 'Customers', to: '/team/customers' },
  { label: 'Products', to: '/team/products-editor', ownerOnly: true },
]

function TeamNavbar() {
  const location = useLocation()
  const { isOwner, logout, user } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const visibleLinks = teamLinks.filter((item) => !item.ownerOnly || isOwner)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      setLoggingOut(false)
    }
  }

  function isLinkActive(item) {
    return item.to === '/team'
      ? location.pathname === '/team' || location.pathname === '/team/orders'
      : location.pathname === item.to
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-gradient-to-r from-[#102848] via-[#17365d] to-[#214672] text-white shadow-sm backdrop-blur">
      <nav className="container-shell py-3">
        <div className="flex items-start justify-between gap-3 sm:hidden">
          <div className="min-w-0">
            <img
              src="/Logo_image.png"
              alt="Bilta logo"
              className="h-11 w-auto object-contain"
            />
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-yellow">Team CMS</p>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((current) => !current)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="flex h-11 w-11 items-center justify-center border border-white/20 bg-white/8 text-white transition hover:border-yellow hover:text-yellow"
          >
            <span className="sr-only">Toggle navigation</span>
            <span className="flex w-5 flex-col gap-1.5">
              <span
                className={`block h-0.5 bg-current transition ${mobileMenuOpen ? 'translate-y-2 rotate-45' : ''}`}
              />
              <span
                className={`block h-0.5 bg-current transition ${mobileMenuOpen ? 'opacity-0' : ''}`}
              />
              <span
                className={`block h-0.5 bg-current transition ${mobileMenuOpen ? '-translate-y-2 -rotate-45' : ''}`}
              />
            </span>
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="mt-3 space-y-3 border border-white/15 bg-white/10 p-3 sm:hidden">
            <div className="border border-white/15 bg-white/10 px-3 py-2 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-yellow">
                {isOwner ? 'Owner/Admin' : 'Staff'}
              </p>
              <p className="mt-1 text-sm font-bold text-white">
                {user?.display_name || user?.username || 'Team User'}
              </p>
            </div>

            <div className="grid gap-2">
              {visibleLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`border px-3 py-3 text-sm font-semibold transition ${
                    isLinkActive(item)
                      ? 'border-yellow bg-yellow text-slate-900'
                      : 'border-white/20 bg-white/8 text-white hover:border-yellow hover:text-yellow'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/"
                className="border border-white/20 bg-white/8 px-3 py-3 text-center text-sm font-semibold text-white transition hover:border-yellow hover:text-yellow"
              >
                Main Website
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="border border-white/20 bg-white/8 px-3 py-3 text-sm font-semibold text-white transition hover:border-yellow hover:text-yellow disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loggingOut ? 'Signing Out...' : 'Sign Out'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="hidden flex-wrap items-center justify-between gap-3 sm:flex">
          <div>
            <img
              src="/Logo_image.png"
              alt="Bilta logo"
              className="h-12 w-auto object-contain"
            />
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-yellow">Team CMS</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {visibleLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold transition ${
                  isLinkActive(item)
                    ? 'border-yellow bg-yellow text-slate-900'
                    : 'border-white/20 bg-white/8 text-white hover:border-yellow hover:text-yellow'
                }`}
              >
                {item.label}
              </Link>
            ))}

            <Link
              to="/"
              className="rounded-md border border-white/20 bg-white/8 px-3 py-1.5 text-sm font-semibold text-white transition hover:border-yellow hover:text-yellow"
            >
              Main Website
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-md border border-white/20 bg-white/8 px-3 py-1.5 text-sm font-semibold text-white transition hover:border-yellow hover:text-yellow disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loggingOut ? 'Signing Out...' : 'Sign Out'}
            </button>

            <div className="border border-white/15 bg-white/10 px-3 py-1.5 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-yellow">
                {isOwner ? 'Owner/Admin' : 'Staff'}
              </p>
              <p className="text-sm font-bold text-white">{user?.display_name || user?.username || 'Team User'}</p>
            </div>
          </div>
        </div>
      </nav>
    </header>
  )
}

export default TeamNavbar
