import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MessageCircleMore, UploadCloud } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { getProductsData } from '../services/productsService'
import { getOrderDraft, saveOrderDraft } from '../services/productOrderFlowService'
import { submitPublicDesignRequest } from '../services/publicOrdersService'
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

function ProductDesignRequestPage() {
  const { slug } = useParams()
  const [products, setProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const baseDraft = useMemo(() => getOrderDraft(slug), [slug])
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [form, setForm] = useState(() => ({
    fullName: '',
    phone: '',
    email: '',
    quantity: String(baseDraft.quantity || 1),
    requestDetails: baseDraft.notes || '',
    uploadedDesigns: baseDraft.uploadedDesigns || [],
    noLogo: false,
  }))

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

  const canSubmit =
    form.fullName.trim() &&
    form.phone.trim() &&
    form.email.trim() &&
    Number(form.quantity || 0) > 0 &&
    form.requestDetails.trim() &&
    (form.uploadedDesigns.length > 0 || form.noLogo)

  const whatsappHref = useMemo(() => {
    const message = [
      `Hello Bilta, I want to send a design request for ${product?.title || 'a product'}.`,
      `Quantity: ${form.quantity || 1}`,
      form.fullName ? `Name: ${form.fullName}` : '',
      form.phone ? `Phone: ${form.phone}` : '',
      form.email ? `Email: ${form.email}` : '',
      form.requestDetails ? `Request details: ${form.requestDetails}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    return buildWhatsAppUrl(message)
  }, [form.email, form.fullName, form.phone, form.quantity, form.requestDetails, product?.title])

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleUploadChange(event) {
    try {
      const nextUploads = await prepareUploadEntries(event.target.files)
      setForm((current) => ({ ...current, uploadedDesigns: nextUploads }))
      setStatusMessage('')
    } catch (error) {
      setStatusMessage(error.message || 'We could not prepare those files for upload.')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setStatusMessage('')

    try {
      saveOrderDraft(slug, {
        quantity: Number(form.quantity || 1),
        size: baseDraft.size,
        finishing: baseDraft.finishing,
        notes: form.requestDetails,
        uploadedDesigns: form.uploadedDesigns.map(({ name, size, type }) => ({ name, size, type })),
      })

      await submitPublicDesignRequest({
        product_slug: product.slug,
        product_title: product.title,
        quantity: Number(form.quantity || 1),
        full_name: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        request_details: form.requestDetails.trim(),
        uploaded_design_names: form.uploadedDesigns.map((file) => file.name),
        no_logo: form.noLogo,
      }, form.uploadedDesigns.map((item) => item.file))

      setSubmitted(true)
    } catch (error) {
      setStatusMessage(error.message || 'We could not submit your design request right now.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <>
        <Navbar />
        <main className="container-shell py-20">
          <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">Preparing request page...</h1>
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
          <div className="pointer-events-none absolute right-10 top-12 h-24 w-24 rounded-full bg-white/10 blur-3xl" />
          <div className="container-shell relative">
            <p className="text-sm font-semibold uppercase tracking-widest text-yellow">Design Request</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-extrabold text-white sm:text-5xl">
              Send your request for {product.title}.
            </h1>
            <p className="mt-5 max-w-3xl text-[17px] leading-relaxed text-slate-100">
              Share all the information Bilta needs to build the design correctly, including your content,
              remarks, references, and any file assets you already have.
            </p>
          </div>
        </section>

        <section className="bg-[#F4F8FC] py-12 md:py-14">
          <div className="container-shell grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <form onSubmit={handleSubmit} className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Request Details
              </p>
              <h2 className="mt-1 text-2xl font-extrabold text-navy">Tell Bilta what to design</h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">
                  Full name
                  <input
                    value={form.fullName}
                    onChange={(event) => updateField('fullName', event.target.value)}
                    className={inputClass}
                    required
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Phone number
                  <input
                    value={form.phone}
                    onChange={(event) => updateField('phone', event.target.value)}
                    className={inputClass}
                    required
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Email address
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    className={inputClass}
                    required
                  />
                </label>

                <label className="text-sm font-semibold text-slate-700">
                  Quantity
                  <input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(event) => updateField('quantity', event.target.value)}
                    className={inputClass}
                    required
                  />
                </label>
              </div>

              <div className="mt-5 border border-yellow/40 bg-yellow/10 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Graphics Design Fee
                </p>
                <p className="mt-2 text-lg font-extrabold text-slate-900">Quoted separately after review</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  The design support fee depends on the complexity of the job and will be confirmed before production starts.
                </p>
              </div>

              <p className="mt-5 text-sm leading-6 text-slate-700">
                Please include all contact details and information you want in your design here. Add all remarks,
                preferred colours, references and additional instructions here.
              </p>

              <label className="mt-4 block text-sm font-semibold text-slate-700">
                Please be detailed, for business cards please input the company name, your name, your position,
                contact details company addres.
                <textarea
                  value={form.requestDetails}
                  onChange={(event) => updateField('requestDetails', event.target.value)}
                  rows={8}
                  className={inputClass}
                  placeholder="Enter request details"
                  required
                />
              </label>

              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-700">Upload design (e.g. logo) asset if any</p>
                <label className="mt-3 flex cursor-pointer flex-col items-center justify-center border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-navy hover:bg-navy/5">
                  <input type="file" multiple className="hidden" onChange={handleUploadChange} />
                  <UploadCloud size={28} className="text-navy" />
                  <p className="mt-4 text-lg font-bold text-slate-900">Drag and drop to upload</p>
                  <p className="mt-1 text-sm text-slate-500">or click here to select a file from your system</p>
                </label>

                {form.uploadedDesigns.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {form.uploadedDesigns.map((file) => (
                      <span
                        key={`${file.name}-${file.size}`}
                        className="border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        {file.name} ({formatFileSize(file.size)})
                      </span>
                    ))}
                  </div>
                ) : null}

                <label className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.noLogo}
                    onChange={(event) => updateField('noLogo', event.target.checked)}
                    className="h-4 w-4 accent-navy"
                  />
                  <span>I don&apos;t have a logo</span>
                </label>
              </div>

              {canSubmit ? (
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              ) : (
                <p className="mt-6 text-sm text-slate-500">
                  Complete your contact details, quantity, and request notes, then upload a file or tick the logo checkbox to reveal the submit button.
                </p>
              )}

              {statusMessage ? (
                <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {statusMessage}
                </div>
              ) : null}

              {submitted ? (
                <div className="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Your request has been submitted successfully. We&apos;ll contact you with the next step.
                </div>
              ) : null}

              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 border-2 border-navy px-5 py-3 text-sm font-bold text-navy transition hover:bg-navy hover:text-white md:w-auto"
              >
                <MessageCircleMore size={18} />
                Chat on WhatsApp Instead
              </a>
            </form>

            <aside className="overflow-hidden border border-navy/20 bg-gradient-to-br from-[#102848] via-[#17365d] to-[#214672] text-white shadow-sm md:sticky md:top-[96px]">
              <div className="relative p-5 md:p-6">
                <div className="pointer-events-none absolute -right-8 top-8 h-24 w-24 rounded-full bg-yellow/20 blur-3xl" />
                <div className="pointer-events-none absolute left-10 top-1/2 h-24 w-24 rounded-full bg-white/10 blur-3xl" />

                <p className="relative text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow">
                  Product Sample
                </p>
                <h2 className="relative mt-2 text-3xl font-extrabold text-white">{product.title}</h2>
                <p className="relative mt-2 text-sm font-semibold uppercase tracking-widest text-slate-200">
                  {product.category}
                </p>

                <div className="relative mt-6 overflow-hidden border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur-sm">
                  <img
                    src={product.image}
                    alt={product.title}
                    className="h-[320px] w-full border border-white/15 object-cover"
                  />
                </div>

                <div className="relative mt-6 grid gap-3">
                  <div className="border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-yellow">
                      Current Quantity
                    </p>
                    <p className="mt-2 text-2xl font-extrabold text-white">{form.quantity || '1'}</p>
                  </div>

                  <div className="border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-yellow">
                      Price Guide
                    </p>
                    <p className="mt-2 text-xl font-extrabold text-white">{formatPrice(product.price)}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-100">
                      Final pricing may change based on the design work, finishing, and production complexity.
                    </p>
                  </div>

                  <div className="border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-yellow">
                      Use This Sample
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-100">
                      Use this product image as your visual reference while describing the layout, colours, logo placement,
                      and every detail you want Bilta to follow.
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

const inputClass =
  'mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-navy'

export default ProductDesignRequestPage
