import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, UploadCloud, WandSparkles } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { getProductsData } from '../services/productsService'
import { addCartItem } from '../services/cartService'
import { saveUploadDraftFiles } from '../services/uploadDraftVault'
import {
  buildSpecificationSummary,
  getOrderDraft,
  saveOrderDraft,
} from '../services/productOrderFlowService'
import { formatFileSize, prepareUploadEntries } from '../utils/uploadFiles'
import { buildWhatsAppUrl } from '../utils/whatsapp'

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

function ProductOrderOptionsPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [uploadedDesigns, setUploadedDesigns] = useState(() => getOrderDraft(slug).uploadedDesigns)

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
  const orderDraft = useMemo(() => getOrderDraft(slug), [slug])
  const specificationSummary = useMemo(() => buildSpecificationSummary(orderDraft), [orderDraft])

  async function handleUploadChange(event) {
    try {
      const nextUploads = await prepareUploadEntries(event.target.files)
      setUploadedDesigns(nextUploads)
      saveOrderDraft(slug, {
        ...orderDraft,
        uploadedDesigns: nextUploads.map(({ name, size, type }) => ({ name, size, type })),
      })
    } catch (error) {
      window.alert(error.message || 'We could not prepare those files for upload.')
    }
  }

  function handleProceedToCheckout() {
    if (!product || !uploadedDesigns.length) return

    const uploadBundleId = saveUploadDraftFiles(uploadedDesigns)

    const cartItem = {
      cartKey: `${product.slug}-${Date.now()}`,
      slug: product.slug,
      title: product.title,
      price: product.price,
      image: product.image,
      quantity: orderDraft.quantity,
      requestMode: 'upload',
      specificationSummary,
      uploadBundleId,
      uploadedDesignNames: uploadedDesigns.map((item) => item.name),
    }

    addCartItem(cartItem)
    navigate('/checkout', { state: { product: cartItem } })
  }

  if (isLoading) {
    return (
      <>
        <Navbar />
        <main className="container-shell py-20">
          <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">Preparing your order path...</h1>
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
          <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">Product not found.</h1>
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
        <section className="relative overflow-hidden bg-navy py-16 text-white md:py-20">
          <div className="pointer-events-none absolute -left-8 top-8 h-32 w-32 rounded-full bg-yellow/20 blur-3xl" />
          <div className="pointer-events-none absolute right-10 top-10 h-24 w-24 rounded-full bg-white/10 blur-3xl" />
          <div className="container-shell relative">
            <p className="text-sm font-semibold uppercase tracking-widest text-yellow">Next Step</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-extrabold text-white sm:text-5xl">
              How would you like to continue with {product.title}?
            </h1>
            <p className="mt-5 max-w-3xl text-[17px] leading-relaxed text-slate-100">
              Your quantity is ready. You can upload your finished design, or send a request if you
              want Bilta to help create it.
            </p>
          </div>
        </section>

        <section className="bg-[#F4F8FC] py-12 md:py-14">
          <div className="container-shell grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <div className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Order Summary
                </p>
                <h2 className="mt-1 text-2xl font-extrabold text-navy">Your selection</h2>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <InfoChip label="Quantity" value={String(orderDraft.quantity)} />
                  <InfoChip label="Price" value={formatPrice(product.price)} />
                </div>

                {specificationSummary ? (
                  <div className="mt-4 border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                    {specificationSummary}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <article className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                  <div className="flex h-12 w-12 items-center justify-center border border-yellow/40 bg-yellow/15 text-navy">
                    <UploadCloud size={22} />
                  </div>
                  <h2 className="mt-5 text-2xl font-extrabold text-slate-900">Upload design</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Already have your print-ready file? Upload it, review your selection, and move straight to checkout.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(true)}
                    className="btn-primary mt-6 inline-flex items-center gap-2"
                  >
                    Upload Now
                    <ArrowRight size={16} />
                  </button>
                </article>

                <article className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                  <div className="flex h-12 w-12 items-center justify-center border border-navy/20 bg-navy/5 text-navy">
                    <WandSparkles size={22} />
                  </div>
                  <h2 className="mt-5 text-2xl font-extrabold text-slate-900">Send request</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Need Bilta to help with the design or layout? Send your request with your details, references, and instructions.
                  </p>
                  <Link
                    to={`/products/${product.slug}/request-design`}
                    className="mt-6 inline-flex items-center gap-2 border-2 border-navy px-5 py-3 text-sm font-bold text-navy transition hover:bg-navy hover:text-white"
                  >
                    Send Request
                    <ArrowRight size={16} />
                  </Link>
                </article>
              </div>

              <div className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Prefer WhatsApp?
                </p>
                <h2 className="mt-1 text-2xl font-extrabold text-navy">Chat instead</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  If you would rather explain the job directly, you can continue the conversation on WhatsApp instead.
                </p>
                <a
                  href={buildWhatsAppUrl(
                    `Hello Bilta, I want to order ${product.title}. Quantity: ${orderDraft.quantity}.`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-2 border-2 border-navy px-5 py-3 text-sm font-bold text-navy transition hover:bg-navy hover:text-white"
                >
                  Chat on WhatsApp Instead
                </a>
              </div>
            </div>

            <aside className="border border-slate-200 bg-white p-5 shadow-sm md:sticky md:top-[96px] md:p-6">
              <img src={product.image} alt={product.title} className="h-[300px] w-full border border-slate-200 object-cover" />
              <p className="mt-5 text-sm font-semibold uppercase tracking-widest text-navy">{product.category}</p>
              <h2 className="mt-2 text-3xl font-extrabold text-slate-900">{product.title}</h2>
              <p className="mt-4 text-sm leading-6 text-slate-600">{product.description}</p>
            </aside>
          </div>
        </section>

        {isUploadModalOpen ? (
          <div className="fixed inset-0 z-[80] bg-slate-950/55 p-4 backdrop-blur-sm">
            <div className="mx-auto flex min-h-full max-w-2xl items-center justify-center">
              <div className="w-full border border-slate-200 bg-white p-5 shadow-[0_30px_90px_rgba(15,23,42,0.28)] md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Upload Design
                    </p>
                    <h2 className="mt-1 text-2xl font-extrabold text-navy">Add your print file</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-navy hover:text-navy"
                  >
                    Close
                  </button>
                </div>

                <label className="mt-6 flex cursor-pointer flex-col items-center justify-center border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center transition hover:border-navy hover:bg-navy/5">
                  <input type="file" multiple className="hidden" onChange={handleUploadChange} />
                  <UploadCloud size={28} className="text-navy" />
                  <p className="mt-4 text-lg font-bold text-slate-900">Drag files here or click here to browse</p>
                  <p className="mt-2 text-sm text-slate-500">
                    PDF, JPG, PNG, AI, PSD, or any file you want Bilta to work from.
                  </p>
                </label>

                {uploadedDesigns.length ? (
                  <div className="mt-5">
                    <p className="text-sm font-semibold text-slate-700">Uploaded files</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {uploadedDesigns.map((file) => (
                        <span
                          key={`${file.name}-${file.size}`}
                          className="border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
                        >
                          {file.name} ({formatFileSize(file.size)})
                        </span>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleProceedToCheckout}
                      className="btn-primary mt-6 w-full md:w-auto"
                    >
                      Proceed to Cart
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </main>
      <Footer />
    </>
  )
}

function InfoChip({ label, value }) {
  return (
    <div className="border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-extrabold text-slate-900">{value}</p>
    </div>
  )
}

export default ProductOrderOptionsPage
