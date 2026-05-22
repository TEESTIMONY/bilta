import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, ShoppingCart, X } from 'lucide-react'
import { getCartCount } from '../services/cartService'
import { buildWhatsAppUrl } from '../utils/whatsapp'

const mainNavItems = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' },
  { label: 'Shop', to: '/products' },
  { label: 'Services', to: '/services' },
  { label: 'Contact', to: '/contact' },
]

const moreNavItems = [
  { label: 'Business Kits', to: '/business-kits' },
  { label: 'Event Branding', to: '/event-branding' },
  { label: 'Book Printing', to: '/book-printing' },
  { label: 'How It Works', to: '/how-it-works' },
]

function Navbar() {
  const location = useLocation()
  const routeKey = `${location.pathname}${location.hash}`

  return <NavbarContent key={routeKey} location={location} />
}

function NavbarContent({ location }) {
  const [open, setOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const refresh = () => setCartCount(getCartCount())
    refresh()
    window.addEventListener('cart:updated', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('cart:updated', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const isActive = (to) => {
    if (to.includes('#')) {
      const [path, hash] = to.split('#')
      return location.pathname === path && location.hash === `#${hash}`
    }
    return location.pathname === to
  }

  return (
    <header
      className={`animate-fade-in sticky top-0 z-50 border-b bg-white/80 backdrop-blur ${scrolled ? 'border-slate-300 shadow-sm' : 'border-transparent'}`}
    >
      <nav className="container-shell relative py-3">
        <div className="flex items-center justify-between gap-4">
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

          <div className="hidden items-center gap-5 lg:flex">
            {mainNavItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className={`text-sm font-semibold transition duration-300 hover:-translate-y-0.5 hover:text-navy ${
                  isActive(item.to) ? 'text-navy' : 'text-slate-600'
                }`}
              >
                {item.label}
              </Link>
            ))}

            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className="text-sm font-semibold text-slate-600 transition duration-300 hover:-translate-y-0.5 hover:text-navy"
                aria-expanded={moreOpen}
                aria-haspopup="true"
              >
                More
              </button>

              <div
                className={`absolute right-0 top-full mt-3 min-w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl transition-all duration-200 ${
                  moreOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'
                }`}
              >
                {moreNavItems.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={`block rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      isActive(item.to)
                        ? 'bg-navy text-white'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-navy'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <Link
              to="/cart"
              className="relative p-2 text-slate-700 transition hover:text-navy"
              aria-label="Open cart"
            >
              <ShoppingCart size={18} />
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center bg-yellow px-1 text-[10px] font-bold text-navy">
                {cartCount}
              </span>
            </Link>
            <a
              href={buildWhatsAppUrl()}
              className="btn-primary text-sm"
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <Link
              to="/cart"
              className="relative p-2 text-slate-700"
              aria-label="Open cart"
            >
              <ShoppingCart size={18} />
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center bg-yellow px-1 text-[10px] font-bold text-navy">
                {cartCount}
              </span>
            </Link>

            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-lg border border-slate-300 p-2 text-slate-700"
              aria-label="Toggle menu"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        <div
          className={`absolute left-0 right-0 top-full z-50 px-4 transition-all duration-300 sm:px-6 lg:hidden lg:px-8 ${
            open ? 'pointer-events-auto translate-y-2 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'
          }`}
        >
          <div className="container-shell space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
            {[...mainNavItems, ...moreNavItems].map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className={`block rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  isActive(item.to)
                    ? 'bg-navy text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-navy'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <a
              href={buildWhatsAppUrl()}
              className="btn-primary block text-center text-sm"
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </nav>
    </header>
  )
}

export default Navbar
