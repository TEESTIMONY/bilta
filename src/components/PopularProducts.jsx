import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProductsData } from '../services/productsService'

function PopularProducts() {
  const [popularProducts, setPopularProducts] = useState([])

  useEffect(() => {
    let isMounted = true

    async function loadPopularProducts() {
      const data = await getProductsData()
      if (!isMounted) return
      setPopularProducts((data?.products || []).slice(0, 4))
    }

    loadPopularProducts()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <section className="bg-white py-16 md:py-20">
      <div className="container-shell">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Popular products
            </p>
            <h2 className="mt-2 max-w-3xl text-3xl font-extrabold sm:text-4xl text-slate-900">
              Most ordered products from our shop.
            </h2>
          </div>

          <Link to="/products" className="btn-primary inline-flex items-center gap-2">
            See all products <ArrowRight size={16} />
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {popularProducts.map((product) => (
            <Link
              key={product.slug}
              to={`/products/${product.slug}`}
              state={{ product }}
              className="group overflow-hidden border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-yellow hover:shadow-lg"
            >
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                <img
                  src={product.image}
                  alt={product.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-500">
                  {product.category}
                </p>
                <h3 className="mt-2 text-base font-bold text-slate-900">{product.title}</h3>
                <p className="mt-2 text-sm font-semibold text-navy">{product.price || 'Price on request'}</p>
              </div>
            </Link>
          ))}

          {!popularProducts.length ? (
            <div className="col-span-full border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
              Popular products will appear here shortly.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default PopularProducts