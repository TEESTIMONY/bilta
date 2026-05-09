import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Search, Sparkles } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { getProductsData } from '../services/productsService'

function getShortDescription(text = '', limit = 80) {
  if (!text) return ''
  if (text.length <= limit) return text
  return `${text.slice(0, limit).trimEnd()}...`
}

function formatPrice(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return 'Price on request'

  const numericCandidate = raw.replace(/[â‚¦,\s]/g, '')
  if (/^\d+(\.\d+)?$/.test(numericCandidate)) {
    const amount = Number(numericCandidate)
    if (Number.isFinite(amount)) {
      return `â‚¦${amount.toLocaleString('en-NG')}`
    }
  }

  return raw
}

function Products() {
  const [searchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [filters, setFilters] = useState(['All Products'])
  const [activeFilter, setActiveFilter] = useState('All Products')
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [parallax, setParallax] = useState({ x: 0, y: 0 })
  const categoryFromQuery = searchParams.get('category')
  const deferredSearchTerm = useDeferredValue(searchTerm)

  useEffect(() => {
    let isMounted = true

    async function loadProducts() {
      setIsLoading(true)
      const data = await getProductsData()
      if (!isMounted) return

      setProducts(data.products)
      setFilters(data.filters)
      const requestedCategory =
        categoryFromQuery && data.filters.includes(categoryFromQuery) ? categoryFromQuery : null

      setActiveFilter((current) => {
        if (requestedCategory) return requestedCategory
        return data.filters.includes(current) ? current : data.filters[0] || 'All Products'
      })
      setIsLoading(false)
    }

    loadProducts()

    return () => {
      isMounted = false
    }
  }, [categoryFromQuery])

  useEffect(() => {
    const nodes = document.querySelectorAll('[data-shop-reveal]')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [filters.length, products.length, activeFilter, deferredSearchTerm])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (media.matches) return undefined

    const onMove = (event) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 14
      const y = (event.clientY / window.innerHeight - 0.5) * 14
      setParallax({ x, y })
    }

    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  const visibleProducts = useMemo(() => {
    const filteredByCategory =
      activeFilter === 'All Products'
        ? products
        : products.filter((item) => item.category === activeFilter)

    const query = deferredSearchTerm.trim().toLowerCase()
    if (!query) return filteredByCategory

    return filteredByCategory.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query),
    )
  }, [activeFilter, deferredSearchTerm, products])

  const hasActiveSearch = deferredSearchTerm.trim().length > 0
  const hasCatalogProducts = products.length > 0

  const groupedProducts = useMemo(() => {
    const order = filters.filter((item) => item !== 'All Products')

    if (activeFilter !== 'All Products') {
      return order
        .filter((category) => category === activeFilter)
        .map((category) => ({
          category,
          items: visibleProducts.filter((item) => item.category === category),
        }))
        .filter((group) => group.items.length > 0)
    }

    return order
      .map((category) => ({
        category,
        items: visibleProducts.filter((item) => item.category === category),
      }))
      .filter((group) => group.items.length > 0)
  }, [activeFilter, filters, visibleProducts])

  return (
    <>
      <Navbar />
      <main>
        <section className="relative overflow-hidden bg-navy py-16 text-white md:py-20">
          <div className="shop-hero-grid pointer-events-none absolute inset-0 opacity-60" />
          <div
            className="shop-orb pointer-events-none absolute -left-10 top-8 h-40 w-40 rounded-full bg-yellow/20 blur-3xl"
            style={{ transform: `translate(${parallax.x * 0.7}px, ${parallax.y * 0.7}px)` }}
          />
          <div
            className="shop-orb shop-orb-delay pointer-events-none absolute right-8 top-1/4 h-32 w-32 rounded-full bg-sky-300/20 blur-3xl"
            style={{ transform: `translate(${-parallax.x * 0.55}px, ${-parallax.y * 0.55}px)` }}
          />
          <div
            className="shop-orb shop-orb-slow pointer-events-none absolute bottom-4 left-1/3 h-28 w-28 rounded-full bg-white/10 blur-3xl"
            style={{ transform: `translate(${parallax.x * 0.35}px, ${-parallax.y * 0.4}px)` }}
          />

          <div className="container-shell relative">
            <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
              <div>
                <p className="animate-fade-up text-sm font-semibold uppercase tracking-widest text-yellow">
                  Shop
                </p>
                <h1 className="animate-fade-up animate-delay-1 mt-3 max-w-4xl text-4xl font-extrabold text-white sm:text-5xl">
                  Shop print products built to help you present better.
                </h1>
                <p className="animate-fade-up animate-delay-2 mt-5 max-w-3xl text-[17px] leading-relaxed text-slate-100">
                  Choose from business printing, event branding, packaging, books, and ready-made
                  kits designed to help your brand, event, or project show up properly.
                </p>
              </div>

              <div className="animate-fade-up animate-delay-2">
                <div className="shop-spotlight-card">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-yellow">
                      Discover faster
                    </p>
                    <Sparkles size={18} className="text-yellow" />
                  </div>
                  <p className="mt-4 text-2xl font-extrabold text-white">
                    Browse by category, search live, and jump straight into the right print job.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#F4F8FC] py-16">
          <div className="mx-auto grid w-full max-w-[92rem] min-w-0 gap-6 px-4 sm:px-6 lg:grid-cols-[300px_1fr] lg:px-8">
            <aside
              className="shop-filter-shell hide-scrollbar min-w-0 lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto"
              data-shop-reveal
            >
              <div className="shop-filter-header">
                <h2 className="text-base font-bold text-slate-900">Filters</h2>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Shop by category
                </p>
              </div>
              <ul className="mt-4 flex w-full max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
                {filters.map((filter, index) => (
                  <li key={filter} className="shrink-0 lg:shrink">
                    <button
                      onClick={() => {
                        startTransition(() => {
                          setActiveFilter(filter)
                        })
                      }}
                      className={`shop-filter-pill ${activeFilter === filter ? 'is-active' : ''}`}
                      style={{ transitionDelay: `${index * 22}ms` }}
                    >
                      <span className="shop-filter-label">{filter}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            <div className="min-w-0">
              {isLoading && (
                <div
                  className="shop-loading-panel mb-4 border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
                  data-shop-reveal
                >
                  Loading products...
                </div>
              )}

              <div className="shop-toolbar" data-shop-reveal>
                <div className="shop-search-shell">
                  <Search size={16} className="text-slate-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search products, services, or categories"
                    className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none"
                  />
                </div>

                <div className="shop-results-meta">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {activeFilter}
                  </span>
                </div>
              </div>

              <div className="mb-6 flex items-end justify-between gap-4" data-shop-reveal>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Featured products
                  </p>
                  <h2 className="mt-2 text-2xl font-extrabold text-slate-900">
                    Find the right print fit for your next move.
                  </h2>
                </div>
              </div>

              {groupedProducts.length ? (
                <div className="space-y-10">
                  {groupedProducts.map((group, groupIndex) => (
                    <section key={group.category} data-shop-reveal>
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Category
                          </p>
                          <h2 className="mt-1 text-xl font-extrabold text-navy">{group.category}</h2>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {group.items.map((product, itemIndex) => (
                          <Link
                            key={product.slug}
                            to={`/products/${product.slug}`}
                            state={{ product }}
                            className="shop-card group block"
                            data-shop-reveal
                            style={{ transitionDelay: `${(groupIndex * 4 + itemIndex) * 55}ms` }}
                          >
                            <div className="shop-card-media">
                              <img
                                src={product.image}
                                alt={product.title}
                                loading="lazy"
                                decoding="async"
                                className="h-64 w-full object-cover transition-transform duration-700 group-hover:scale-[1.08]"
                              />
                              <div className="shop-card-overlay" />
                              <div className="shop-card-badges">
                                <span className="shop-card-badge">{product.category}</span>
                              </div>
                            </div>

                            <div className="p-4">
                              <h3 className="text-lg font-bold text-slate-900 transition-colors duration-300 group-hover:text-navy">
                                {product.title}
                              </h3>
                              <p className="mt-2 text-sm leading-6 text-slate-600">
                                {getShortDescription(product.description, 88)}
                              </p>
                              <div className="mt-4 flex items-end justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                    Starting from
                                  </p>
                                  <p className="mt-1 text-base font-extrabold text-navy">
                                    {formatPrice(product.price)}
                                  </p>
                                </div>
                                <span className="shop-card-cta">
                                  Order now
                                  <ArrowRight size={16} />
                                </span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="shop-empty-state" data-shop-reveal>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {hasCatalogProducts ? 'No matches found' : 'Catalog coming soon'}
                  </p>
                  <h2 className="mt-2 text-2xl font-extrabold text-slate-900">
                    {hasCatalogProducts
                      ? 'Try a broader search or switch categories.'
                      : 'No products have been published yet.'}
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                    {hasCatalogProducts
                      ? 'We couldn&apos;t find products matching your current search. Clear the search box or return to All Products to explore the full catalog.'
                      : 'The shop is connected to your backend catalog, and it will display products here once they are added and published from the CMS.'}
                  </p>
                  {hasCatalogProducts || hasActiveSearch || activeFilter !== 'All Products' ? (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        onClick={() => {
                          startTransition(() => {
                            setSearchTerm('')
                            setActiveFilter('All Products')
                          })
                        }}
                        className="btn-primary"
                      >
                        Reset filters
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

export default Products
