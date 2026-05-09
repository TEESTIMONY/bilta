import { useEffect, useMemo, useState } from 'react'
import TeamNavbar from '../components/TeamNavbar'
import Footer from '../components/Footer'
import { filters as defaultFilters, products as defaultProducts } from '../data/productsData'
import { USE_DJANGO_API } from '../services/api'
import { clearTeamProductsStorage, getProductsData, saveTeamProducts } from '../services/productsService'

const blankProduct = {
  slug: '',
  category: '',
  title: '',
  description: '',
  details: '',
  sizeOptions: [],
  image: '',
  images: [],
  price: '',
}

function buildImages(primaryImage, extraImages = []) {
  const normalized = [primaryImage, ...extraImages]
    .map((item) => String(item || '').trim())
    .filter(Boolean)
  return [...new Set(normalized)]
}

function readFilesAsDataUrls(fileList = []) {
  return Promise.all(
    [...fileList].map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result || ''))
          reader.onerror = () => reject(new Error('Image upload failed'))
          reader.readAsDataURL(file)
        }),
    ),
  )
}

function parseSizeOptions(text = '') {
  return [...new Set(
    text
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean),
  )]
}

function TeamProductsEditor() {
  const [products, setProducts] = useState([])
  const [status, setStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newProduct, setNewProduct] = useState(blankProduct)
  const [newProductStatus, setNewProductStatus] = useState('')
  const [productPendingDelete, setProductPendingDelete] = useState(null)
  const [activeCategory, setActiveCategory] = useState('All')
  const [selectedProductIndex, setSelectedProductIndex] = useState(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadEditorData() {
      const data = await getProductsData()
      if (!isMounted) return

      if (USE_DJANGO_API) {
        setProducts(data.products || [])
        return
      }

      setProducts(data.products?.length ? data.products : defaultProducts)
    }

    loadEditorData()

    return () => {
      isMounted = false
    }
  }, [])

  function updateProduct(index, key, value) {
    setProducts((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)))
  }

  function updatePrimaryImage(index, value) {
    setProducts((current) =>
      current.map((item, i) => {
        if (i !== index) return item
        const extras = Array.isArray(item.images) ? item.images.slice(1) : []
        const images = buildImages(value, extras)
        return { ...item, image: images[0] || '', images }
      }),
    )
  }

  function updateExtraImages(index, text) {
    setProducts((current) =>
      current.map((item, i) => {
        if (i !== index) return item
        const extras = text
          .split('\n')
          .map((entry) => entry.trim())
          .filter(Boolean)
        const images = buildImages(item.image, extras)
        return { ...item, image: images[0] || '', images }
      }),
    )
  }

  function updateSizeOptions(index, text) {
    setProducts((current) =>
      current.map((item, i) => (i === index ? { ...item, sizeOptions: parseSizeOptions(text) } : item)),
    )
  }

  async function handleImageUpload(index, files) {
    if (!files?.length) return

    try {
      const uploadedImages = await readFilesAsDataUrls(files)
      setProducts((current) =>
        current.map((item, i) => {
          if (i !== index) return item
          const existing = Array.isArray(item.images) && item.images.length ? item.images : [item.image]
          const images = buildImages(existing[0], [...existing.slice(1), ...uploadedImages])
          return { ...item, image: images[0] || '', images }
        }),
      )
      setStatus(`${uploadedImages.length} image(s) uploaded for product ${index + 1}. Remember to click "Save".`)
    } catch {
      setStatus('Image upload failed. Please try another file.')
    }
  }

  function openAddModal() {
    setNewProduct({ ...blankProduct, slug: `new-product-${products.length + 1}` })
    setNewProductStatus('')
    setIsAddModalOpen(true)
  }

  async function createProductFromModal() {
    setNewProductStatus('')

    if (!newProduct.slug || !newProduct.title || !newProduct.category || !newProduct.image) {
      setNewProductStatus('Please provide slug, title, category, and image before adding a new product.')
      return
    }

    if (products.some((item) => item.slug === newProduct.slug)) {
      setNewProductStatus('Slug already exists. Please use a unique slug for this new product.')
      return
    }

    const updatedProducts = [...products, { ...newProduct }]

    setIsSaving(true)
    const { ok, source } = await saveTeamProducts(updatedProducts)
    setIsSaving(false)

    if (!ok) {
      setNewProductStatus('Could not save new product to backend. Check slug/image URL and ensure backend is running.')
      return
    }

    setProducts(updatedProducts)
    setActiveCategory('All')
    setIsAddModalOpen(false)
    setStatus(
      source === 'django'
        ? 'New product added and saved to Django API successfully.'
        : 'New product added and saved locally successfully.',
    )
  }

  function updateNewProduct(key, value) {
    setNewProduct((current) => {
      if (key === 'image') {
        const extras = Array.isArray(current.images) ? current.images.slice(1) : []
        const images = buildImages(value, extras)
        return { ...current, image: images[0] || '', images }
      }

      return { ...current, [key]: value }
    })
  }

  function updateNewProductExtraImages(text) {
    setNewProduct((current) => {
      const extras = text
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean)
      const images = buildImages(current.image, extras)
      return { ...current, image: images[0] || '', images }
    })
  }

  function updateNewProductSizeOptions(text) {
    setNewProduct((current) => ({
      ...current,
      sizeOptions: parseSizeOptions(text),
    }))
  }

  async function handleNewProductImageUpload(files) {
    if (!files?.length) return

    try {
      const uploadedImages = await readFilesAsDataUrls(files)
      setNewProduct((current) => {
        const existing = Array.isArray(current.images) && current.images.length ? current.images : [current.image]
        const images = buildImages(existing[0], [...existing.slice(1), ...uploadedImages])
        return { ...current, image: images[0] || '', images }
      })
      setStatus(`${uploadedImages.length} image(s) uploaded for new product. Click Add Product to insert it.`)
    } catch {
      setStatus('Image upload failed. Please try another file.')
    }
  }

  function askRemoveProduct(index) {
    const target = products[index]
    if (!target) return
    setProductPendingDelete({
      index,
      title: target.title || target.slug || 'this product',
    })
  }

  async function removeProduct(index) {
    const updatedProducts = products.filter((_, i) => i !== index)

    setIsSaving(true)
    const { ok, source } = await saveTeamProducts(updatedProducts)
    setIsSaving(false)

    if (!ok) {
      setStatus('Delete failed. Could not remove product from backend.')
      return
    }

    setProducts(updatedProducts)
    setStatus(
      source === 'django'
        ? 'Product removed from Django API successfully.'
        : 'Product removed locally successfully.',
    )
  }

  async function handleSave() {
    setIsSaving(true)
    const { ok, source } = await saveTeamProducts(products)
    setIsSaving(false)

    if (!ok) {
      setStatus('Save failed. Ensure products contain slug/title/category/image and backend is reachable.')
      return
    }

    setStatus(
      source === 'django'
        ? 'Saved to Django API successfully.'
        : 'Saved locally. Refresh Shop page to see changes.',
    )
  }

  function handleReset() {
    clearTeamProductsStorage()
    setProducts(defaultProducts)
    setStatus('Team override cleared. App will use CMS/local source again.')
  }

  const categoryOptions = useMemo(() => {
    const productCategories = products.map((item) => item.category).filter(Boolean)
    const officialCategories = defaultFilters.filter((category) => category !== 'All Products')
    const categories = [...new Set([...officialCategories, ...productCategories])]
    return ['All', ...categories]
  }, [products])

  const visibleProducts = useMemo(() => {
    return products
      .map((product, index) => ({ product, index }))
      .filter(({ product }) => activeCategory === 'All' || product.category === activeCategory)
  }, [activeCategory, products])

  function handleSelectProductRow(index) {
    setSelectedProductIndex(index)
    setIsEditModalOpen(true)
  }

  function closeEditModal() {
    setIsEditModalOpen(false)
    setSelectedProductIndex(null)
  }

  const selectedProduct = selectedProductIndex !== null ? products[selectedProductIndex] : null

  const inputClass =
    'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15'
  const textareaClass =
    'mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-navy focus:ring-2 focus:ring-navy/15'
  const modalInputClass =
    'mt-2 w-full border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-navy focus:ring-4 focus:ring-navy/10'
  const modalTextareaClass =
    'mt-2 w-full border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-navy focus:ring-4 focus:ring-navy/10'

  return (
    <>
      <TeamNavbar />
      <main>
        <section className="container-shell py-12 md:py-14">
          <p className="inline-flex items-center rounded-full border border-navy/20 bg-navy/5 px-3 py-1 text-xs font-bold uppercase tracking-wider text-navy">
            Team CMS
          </p>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Products Editor</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Manage product content, pricing, images, and detail-page options from one structured admin view.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Products</p>
              <p className="mt-1 text-2xl font-extrabold text-navy">{products.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Visible</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{visibleProducts.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Active category</p>
              <p className="mt-1 truncate text-base font-bold text-slate-900">{activeCategory}</p>
            </div>
          </div>
        </section>

        <section className="bg-[#F4F8FC] py-8 md:py-10">
          <div className="container-shell space-y-6">
            <div className="sticky top-2 z-40 rounded-lg border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur md:top-[72px] md:p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Filter category</label>
                  <select
                    value={activeCategory}
                    onChange={(e) => setActiveCategory(e.target.value)}
                    className={inputClass}
                  >
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:justify-end lg:col-start-2">
                  <button onClick={openAddModal} className="btn-primary w-full rounded-md sm:w-auto">Add Product</button>
                  <button onClick={handleSave} disabled={isSaving} className="w-full rounded-md border border-navy px-4 py-2.5 text-sm font-semibold text-navy transition hover:bg-navy hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">{isSaving ? 'Saving...' : 'Save'}</button>
                  <button onClick={handleReset} className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto">Reset</button>
                </div>
              </div>
            </div>

            {status && (
              <div className="rounded-md border border-navy/20 bg-navy/5 px-4 py-3 text-sm text-slate-700">
                {status}
              </div>
            )}

            <div className="border border-yellow/30 bg-yellow/10 px-4 py-3 text-sm text-slate-700 lg:hidden">
              Swipe sideways to see the full product table and quick actions on mobile.
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-[0.12em] text-slate-600">
                  <tr>
                    <th className="px-3 py-3">S/N</th>
                    <th className="px-3 py-3">Title</th>
                    <th className="px-3 py-3">Slug</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Price</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map(({ product, index }, rowIndex) => (
                    <tr
                      key={`table-${product.slug}-${index}`}
                      onClick={() => handleSelectProductRow(index)}
                      className={`cursor-pointer border-t border-slate-100 transition hover:bg-slate-50 ${
                        selectedProductIndex === index ? 'bg-navy/5' : ''
                      }`}
                    >
                      <td className="px-3 py-3 font-semibold text-slate-700">{rowIndex + 1}</td>
                      <td className="px-3 py-3 font-semibold text-slate-900">{product.title || 'Untitled product'}</td>
                      <td className="px-3 py-3 text-slate-600">{product.slug || '-'}</td>
                      <td className="px-3 py-3">{product.category || '-'}</td>
                      <td className="px-3 py-3">{product.price || '-'}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleSelectProductRow(index)}
                            className="rounded-md border border-navy px-2.5 py-1 text-xs font-semibold text-navy transition hover:bg-navy hover:text-white"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => askRemoveProduct(index)}
                            className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isEditModalOpen && selectedProduct ? (
              <div className="fixed inset-0 z-[75] bg-slate-950/60 p-4 backdrop-blur-md">
                <div className="flex min-h-full items-center justify-center">
                  <div className="relative max-h-[92vh] w-full max-w-6xl overflow-hidden border border-white/60 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-yellow/20 via-white to-navy/10" />

                    <div className="hide-scrollbar max-h-[92vh] overflow-y-auto">
                      <div className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/92 px-5 py-4 backdrop-blur md:px-7">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="inline-flex border border-navy/15 bg-navy/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-navy">
                              Product Details
                            </p>
                            <h2 className="mt-3 text-2xl font-extrabold text-navy md:text-3xl">
                              {selectedProduct.title || 'Untitled product'}
                            </h2>
                            <p className="mt-2 text-sm text-slate-500">
                              Edit product content, pricing, media, and product options from one focused popup.
                            </p>
                          </div>
                          <button
                            onClick={closeEditModal}
                            className="border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-navy hover:text-navy hover:shadow-md"
                          >
                            Close
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-6 p-5 md:p-7 xl:grid-cols-[1.15fr_0.85fr]">
                        <div className="space-y-5">
                          <section className="border border-slate-200 bg-slate-50/70 p-5 shadow-sm">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                              Core Details
                            </p>
                            <h3 className="mt-1 text-lg font-extrabold text-slate-900">
                              Product identity
                            </h3>

                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <label className="block text-sm font-semibold text-slate-700">
                                Slug (used in product URL)
                                <input
                                  value={selectedProduct.slug}
                                  onChange={(e) => updateProduct(selectedProductIndex, 'slug', e.target.value)}
                                  className={modalInputClass}
                                  placeholder="one-sided-business-cards"
                                />
                              </label>

                              <label className="block text-sm font-semibold text-slate-700">
                                Category (used for filters)
                                <input
                                  value={selectedProduct.category}
                                  onChange={(e) => updateProduct(selectedProductIndex, 'category', e.target.value)}
                                  className={modalInputClass}
                                  placeholder="BUSINESS CARDS"
                                />
                              </label>

                              <label className="block text-sm font-semibold text-slate-700">
                                Product title
                                <input
                                  value={selectedProduct.title}
                                  onChange={(e) => updateProduct(selectedProductIndex, 'title', e.target.value)}
                                  className={modalInputClass}
                                  placeholder="One-sided Business Cards"
                                />
                              </label>

                              <label className="block text-sm font-semibold text-slate-700">
                                Price (shown on shop cards)
                                <input
                                  value={selectedProduct.price || ''}
                                  onChange={(e) => updateProduct(selectedProductIndex, 'price', e.target.value)}
                                  className={modalInputClass}
                                  placeholder="N12,000 or Price on request"
                                />
                              </label>
                            </div>
                          </section>

                          <section className="border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="grid gap-4">
                              <label className="block text-sm font-semibold text-slate-700">
                                Description (shown on Shop cards)
                                <textarea
                                  value={selectedProduct.description || ''}
                                  onChange={(e) => updateProduct(selectedProductIndex, 'description', e.target.value)}
                                  className={modalTextareaClass}
                                  placeholder="Short product description"
                                  rows={4}
                                />
                              </label>

                              <label className="block text-sm font-semibold text-slate-700">
                                Product details (shown on Product Details page)
                                <textarea
                                  value={selectedProduct.details || ''}
                                  onChange={(e) => updateProduct(selectedProductIndex, 'details', e.target.value)}
                                  className={modalTextareaClass}
                                  placeholder="Full product details for users who open this product"
                                  rows={5}
                                />
                              </label>

                              <label className="block text-sm font-semibold text-slate-700">
                                Size/specification options (one per line)
                                <textarea
                                  value={(selectedProduct.sizeOptions || []).join('\n')}
                                  onChange={(e) => updateSizeOptions(selectedProductIndex, e.target.value)}
                                  className={modalTextareaClass}
                                  placeholder={`Standard size\nPremium size\nCustom specification`}
                                  rows={4}
                                />
                                <span className="mt-2 block text-xs font-medium text-slate-500">
                                  These options will appear as selectable choices on the product details page.
                                </span>
                              </label>
                            </div>
                          </section>
                        </div>

                        <div className="space-y-5">
                          <section className="border border-slate-200 bg-slate-50/70 p-5 shadow-sm">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                              Media
                            </p>
                            <h3 className="mt-1 text-lg font-extrabold text-slate-900">
                              Images and previews
                            </h3>

                            <label className="mt-4 block text-sm font-semibold text-slate-700">
                              Image URL (optional if uploading image below)
                              <input
                                value={selectedProduct.image || ''}
                                onChange={(e) => updatePrimaryImage(selectedProductIndex, e.target.value)}
                                className={modalInputClass}
                                placeholder="https://..."
                              />
                            </label>

                            <label className="mt-4 block text-sm font-semibold text-slate-700">
                              Additional image URLs (one per line)
                              <textarea
                                value={(selectedProduct.images || []).slice(1).join('\n')}
                                onChange={(e) => updateExtraImages(selectedProductIndex, e.target.value)}
                                className={modalTextareaClass}
                                placeholder="https://..."
                                rows={4}
                              />
                            </label>

                            <div className="mt-4 flex flex-wrap items-center gap-3">
                              <label className="border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-navy hover:text-navy hover:shadow-md">
                                Upload image(s)
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => handleImageUpload(selectedProductIndex, e.target.files)}
                                />
                              </label>
                              <span className="text-sm text-slate-500">
                                Paste image URLs or upload one or more files.
                              </span>
                            </div>

                            {(selectedProduct.images || [selectedProduct.image]).filter(Boolean).length ? (
                              <div className="mt-5 border border-slate-200 bg-white p-4 shadow-sm">
                                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                                  Image previews
                                </p>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                  {(selectedProduct.images || [selectedProduct.image]).filter(Boolean).map((image, imageIndex) => (
                                    <div
                                      key={`${selectedProduct.slug || 'selected-product'}-${imageIndex}`}
                                      className="overflow-hidden border border-slate-200 bg-white shadow-sm"
                                    >
                                      <img
                                        src={image}
                                        alt={`${selectedProduct.title || 'Product'} preview ${imageIndex + 1}`}
                                        className="aspect-[4/3] w-full object-cover transition duration-500 hover:scale-105"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </section>

                          <section className="border border-navy/10 bg-navy p-5 text-white shadow-lg">
                            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-yellow">
                              Editing flow
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-100">
                              Make your changes here, then use the main "Save" button on the page to publish them to your current source.
                            </p>
                            <div className="mt-4 flex justify-end">
                              <button
                                onClick={closeEditModal}
                                className="border border-white/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-navy"
                              >
                                Done
                              </button>
                            </div>
                          </section>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {isAddModalOpen ? (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
                <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-2xl md:p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-2xl font-extrabold text-navy">Add New Product</h2>
                    <button
                      onClick={() => setIsAddModalOpen(false)}
                      className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Close
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Slug
                      <input value={newProduct.slug} onChange={(e) => updateNewProduct('slug', e.target.value)} className={inputClass} placeholder="one-sided-business-cards" />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">
                      Category
                      <select
                        value={newProduct.category}
                        onChange={(e) => updateNewProduct('category', e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Select category</option>
                        {categoryOptions
                          .filter((category) => category !== 'All')
                          .map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                      Product title
                      <input value={newProduct.title} onChange={(e) => updateNewProduct('title', e.target.value)} className={inputClass} placeholder="One-sided Business Cards" />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">
                      Price
                      <input value={newProduct.price || ''} onChange={(e) => updateNewProduct('price', e.target.value)} className={inputClass} placeholder="₦12,000" />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                      Description
                      <textarea value={newProduct.description || ''} onChange={(e) => updateNewProduct('description', e.target.value)} className={textareaClass} rows={3} placeholder="Short product description" />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                      Product details
                      <textarea
                        value={newProduct.details || ''}
                        onChange={(e) => updateNewProduct('details', e.target.value)}
                        className={textareaClass}
                        rows={4}
                        placeholder="Full product details for product details page"
                      />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                      Size/specification options (one per line)
                      <textarea
                        value={(newProduct.sizeOptions || []).join('\n')}
                        onChange={(e) => updateNewProductSizeOptions(e.target.value)}
                        className={textareaClass}
                        rows={4}
                        placeholder={`Standard size\nPremium size\nCustom specification`}
                      />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                      Image URL (optional if uploading below)
                      <input value={newProduct.image || ''} onChange={(e) => updateNewProduct('image', e.target.value)} className={inputClass} placeholder="https://..." />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                      Additional image URLs (one per line)
                      <textarea
                        value={(newProduct.images || []).slice(1).join('\n')}
                        onChange={(e) => updateNewProductExtraImages(e.target.value)}
                        className={textareaClass}
                        rows={3}
                        placeholder="https://..."
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      Upload image(s)
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleNewProductImageUpload(e.target.files)} />
                    </label>
                    <span className="text-sm text-slate-500">You can paste image URLs, upload one image, or upload multiple images.</span>
                  </div>

                  {(newProduct.images || [newProduct.image]).filter(Boolean).length ? (
                    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50/70 p-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Image previews</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {(newProduct.images || [newProduct.image]).filter(Boolean).map((image, imageIndex) => (
                          <div key={`new-product-preview-${imageIndex}`} className="overflow-hidden rounded-md border border-slate-200 bg-white">
                            <img
                              src={image}
                              alt={`${newProduct.title || 'New product'} preview ${imageIndex + 1}`}
                              className="aspect-[4/3] w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-6 flex justify-end gap-2">
                    <button onClick={() => setIsAddModalOpen(false)} className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                    <button onClick={createProductFromModal} disabled={isSaving} className="rounded-md border border-navy bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a2347] disabled:opacity-60 disabled:cursor-not-allowed">{isSaving ? 'Adding...' : 'Add Product'}</button>
                  </div>
                  {newProductStatus ? (
                    <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{newProductStatus}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {productPendingDelete ? (
              <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl md:p-6">
                  <h3 className="text-lg font-extrabold text-navy">Delete Product</h3>
                  <p className="mt-2 text-sm text-slate-700">
                    You are about to permanently delete{' '}
                    <span className="font-semibold">“{productPendingDelete.title}”</span>. This action cannot be undone.
                  </p>
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      onClick={() => setProductPendingDelete(null)}
                      className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        const { index } = productPendingDelete
                        setProductPendingDelete(null)
                        await removeProduct(index)
                      }}
                      disabled={isSaving}
                      className="rounded-md border border-red-600 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? 'Deleting...' : 'Delete Product'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

export default TeamProductsEditor


