import { Link } from 'react-router-dom'

function Footer() {
  return (
    <footer className="bg-navy-deeper text-white">
      <div className="container-shell grid gap-8 py-12 md:grid-cols-3">
        <div>
          <img
            src="/Logo_image.png"
            alt="Bilta logo"
            className="h-12 w-auto object-contain"
          />
          <p className="mt-3 max-w-sm text-sm text-slate-300">
            Bilta helps businesses print, brand, and package themselves properly.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-bold text-white">Services</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>Printing</li>
            <li>Branding Materials</li>
            <li>Packaging & Labels</li>
            <li>Event Production</li>
            <li>Book Printing</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-bold text-white">Company</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>
              <Link to="/about" className="transition hover:text-yellow">
                About
              </Link>
            </li>
            <li>
              <Link to="/products" className="transition hover:text-yellow">
                Shop
              </Link>
            </li>
            <li>
              <Link to="/services" className="transition hover:text-yellow">
                Services
              </Link>
            </li>
            <li>
              <Link to="/faq" className="transition hover:text-yellow">
                FAQ
              </Link>
            </li>
            <li>
              <Link to="/contact" className="transition hover:text-yellow">
                Contact
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-4">
        <div className="container-shell flex flex-col justify-between gap-2 text-xs text-slate-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Bilta. All rights reserved.</p>
          <p>
            Built on over 30 years of service, Bilta is a growing print and brand support company
            helping businesses show up with more clarity, consistency, and confidence.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer