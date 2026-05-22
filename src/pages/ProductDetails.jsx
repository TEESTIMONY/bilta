import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { getProductsData } from '../services/productsService'
import { getOrderDraft, saveOrderDraft } from '../services/productOrderFlowService'

function formatPrice(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return 'Price on request'

  const numericCandidate = raw.replace(/[₦,\s]/g, '')
  if (/^\d+(\.\d+)?$/.test(numericCandidate)) {
    const amount = Number(numericCandidate)
    if (Number.isFinite(amount)) {
      return `₦${amount.toLocaleString('en-NG')}`
    }
  }

  return raw
}

function ProductDetails() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState('')
  const initialDraft = useMemo(() => getOrderDraft(slug), [slug])
  const [quantity, setQuantity] = useState(Math.max(1, Number(initialDraft.quantity || 1)))

  useEffect(() => {
    let isMounted = true

    async function loadProducts() {
      setIsLoading(true)
      const data = await getProductsData()
      if (!isMounted) return
      setProducts(data.products)
      setIsLoading(false)
    }

    loadProducts()

    return () => {
      isMounted = false
    }
  }, [])

  const product = useMemo(() => products.find((item) => item.slug === slug), [products, slug])
  const productImages = useMemo(() => {
    if (!product) return []
    const images = Array.isArray(product.images) && product.images.length ? product.images : [product.image]
    return [...new Set(images.map((entry) => String(entry || '').trim()).filter(Boolean))]
  }, [product])

  const relatedProducts = useMemo(() => {
    if (!product) return []

    return products
      .filter((item) => item.slug !== product.slug && item.category === product.category)
      .slice(0, 4)
  }, [product, products])

  const activeImage =
    productImages.includes(selectedImage) ? selectedImage : productImages[0] || product?.image || ''

  useEffect(() => {
    if (!product) return
    setQuantity(Math.max(1, Number(initialDraft.quantity || 1)))
  }, [initialDraft.quantity, product])

  function handleContinueOrder() {
    if (!product) return
    saveOrderDraft(product.slug, {
      quantity,
    })
    navigate(`/products/${product.slug}/order`)
  }

  if (isLoading) {
    return (
      <>
        <Navbar />
        <main className="container-shell py-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-navy">Product</p>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Loading product...</h1>
        </main>
        <Footer />
      </>
    )
  }

  if (!product) {
    return (
      <>
        <Navbar />
        <main className="container-shell py-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-navy">Product</p>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Product not found.</h1>
          <p className="mt-4 max-w-2xl text-slate-600">
            The product you are looking for may have been removed or the link is incorrect.
          </p>
          <Link to="/products" className="btn-primary mt-6 inline-block">
            Back to Products
          </Link>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main>
        <section className="container-shell py-16 md:py-20">
          <Link to="/products" className="text-sm font-semibold text-navy hover:underline">
            â† Back to Products
          </Link>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
            <div className="border border-slate-200 bg-white p-4 shadow-sm">
              <img
                src={activeImage || product.image}
                alt={product.title}
                className="h-[280px] w-full border border-slate-200 object-cover sm:h-[460px]"
              />

              {productImages.length > 1 ? (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {productImages.map((image, index) => (
                    <button
                      key={`${product.slug}-thumb-${index}`}
                      type="button"
                      onClick={() => setSelectedImage(image)}
                      className={`overflow-hidden border ${activeImage === image ? 'border-navy' : 'border-slate-200'}`}
                    >
                      <img
                        src={image}
                        alt={`${product.title} ${index + 1}`}
                        className="h-16 w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-navy">{product.category}</p>
              <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{product.title}</h1>
              <p className="mt-4 whitespace-pre-wrap text-[17px] leading-relaxed text-slate-600">{product.details || product.description}</p>
              <p className="mt-3 text-base font-semibold text-navy">{formatPrice(product.price)}</p>

              <div className="mt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="sm:min-w-[180px]">
                    <label className="block text-sm font-semibold text-slate-700">
                      Quantity
                      <div className="mt-2 flex items-center border border-slate-300 bg-white">
                        <button
                          type="button"
                          onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                          className="px-4 py-3 text-lg font-bold text-slate-700 transition hover:bg-slate-50"
                          aria-label="Decrease quantity"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value || 1)))}
                          className="w-full border-x border-slate-300 px-3 py-3 text-center text-sm font-semibold outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setQuantity((current) => current + 1)}
                          className="px-4 py-3 text-lg font-bold text-slate-700 transition hover:bg-slate-50"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    </label>
                  </div>

                  <div className="sm:pb-[1px]">
                    <button
                      onClick={handleContinueOrder}
                      className="btn-primary w-full sm:w-auto"
                    >
                      Order Now
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    to="/contact"
                    className="border-2 border-navy px-5 py-3 text-sm font-bold text-navy transition hover:bg-navy hover:text-white"
                  >
                    Talk to Bilta
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 p-0">
            <h2 className="text-2xl font-extrabold">Description</h2>
            <p className="mt-4 text-lg font-bold text-slate-900">{product.title}</p>
            <p className="mt-2 whitespace-pre-wrap text-[17px] leading-relaxed text-slate-600">{product.description}</p>
          </div>

          <div className="mt-10">
            <h2 className="text-2xl font-extrabold">Related products</h2>

            {relatedProducts.length ? (
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {relatedProducts.map((item) => (
                  <article key={item.slug} className="border border-slate-200 bg-white p-4 shadow-sm">
                    <img src={item.image} alt={item.title} className="h-44 w-full border border-slate-200 object-cover" />
                    <h3 className="mt-3 text-base font-bold">{item.title}</h3>
                    <p className="mt-2 text-sm font-semibold text-navy">{formatPrice(item.price)}</p>
                    <Link
                      to={`/products/${item.slug}`}
                      className="mt-3 inline-block border-2 border-navy px-4 py-2 text-xs font-bold text-navy transition hover:bg-navy hover:text-white"
                    >
                      View Product
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-600">No related products found in this category yet.</p>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

export default ProductDetails
