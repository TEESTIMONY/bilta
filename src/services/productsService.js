import { filters as localFilters, products as localProducts } from '../data/productsData'
import { DJANGO_API_BASE, USE_DJANGO_API, fetchAllPages, fetchJson } from './api'

const TEAM_PRODUCTS_STORAGE_KEY = 'bilta_team_products_v1'

function hasRequiredProductFields(item) {
  return item && item.slug && item.title && item.category && item.image
}

function normalizeImageList(item) {
  const fromArray = Array.isArray(item?.images) ? item.images : []
  const candidate = [item?.image, ...fromArray]
  return [...new Set(candidate.map((entry) => String(entry || '').trim()).filter(Boolean))]
}

function normalizeProductItem(item) {
  const images = normalizeImageList(item)
  const primaryImage = images[0] || String(item?.image || '').trim()
  const sizeOptions = Array.isArray(item?.sizeOptions ?? item?.size_options)
    ? [...new Set((item?.sizeOptions ?? item?.size_options).map((entry) => String(entry || '').trim()).filter(Boolean))]
    : []

  return {
    ...item,
    image: primaryImage,
    images,
    details: item?.details || item?.description || '',
    sizeOptions,
  }
}

function normalizeProducts(items) {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => normalizeProductItem(item))
    .filter(hasRequiredProductFields)
}

function deriveFiltersFromProducts(items) {
  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))]
  return ['All Products', ...categories]
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function toApiProductPayload(item) {
  return {
    slug: item.slug,
    category: item.category,
    title: item.title,
    description: item.description || '',
    details: item.details || item.description || '',
    price: item.price || 'Price on request',
    size_options: Array.isArray(item.sizeOptions) ? item.sizeOptions : [],
    image: item.image,
    images: Array.isArray(item.images) ? item.images : [item.image].filter(Boolean),
    is_active: item.is_active ?? true,
  }
}

async function getProductsFromDjango() {
  const items = await fetchAllPages(`${DJANGO_API_BASE}/products/`)
  const products = normalizeProducts(items)

  if (!products.length) {
    return {
      products: [],
      filters: deriveFiltersFromProducts([]),
      source: 'django-empty',
    }
  }

  return {
    products,
    filters: deriveFiltersFromProducts(products),
    source: 'django',
  }
}

async function upsertProductsToDjango(products) {
  const normalized = normalizeProducts(products)
  if (!normalized.length) return false

  const existing = await fetchAllPages(`${DJANGO_API_BASE}/products/`)
  const existingBySlug = new Map(existing.map((item) => [item.slug, item]))
  const incomingSlugs = new Set(normalized.map((item) => item.slug))

  for (const item of normalized) {
    const payload = toApiProductPayload(item)
    const current = existingBySlug.get(item.slug)

    if (current?.id) {
      await fetchJson(`${DJANGO_API_BASE}/products/${current.id}/`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
    } else {
      await fetchJson(`${DJANGO_API_BASE}/products/`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    }
  }

  for (const item of existing) {
    if (!incomingSlugs.has(item.slug) && item.id) {
      await fetchJson(`${DJANGO_API_BASE}/products/${item.id}/`, { method: 'DELETE' })
    }
  }

  return true
}

export function getTeamProductsFromStorage() {
  if (!isBrowser()) return null

  try {
    const raw = window.localStorage.getItem(TEAM_PRODUCTS_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    const storedProducts = normalizeProducts(Array.isArray(parsed) ? parsed : parsed.products)
    if (!storedProducts.length) return null

    const storedFilters =
      Array.isArray(parsed?.filters) && parsed.filters.length
        ? parsed.filters
        : deriveFiltersFromProducts(storedProducts)

    return { products: storedProducts, filters: storedFilters, source: 'team-storage' }
  } catch (error) {
    console.warn('[productsService] Invalid team products in storage:', error)
    return null
  }
}

export function saveTeamProductsToStorage(products, filters) {
  if (USE_DJANGO_API) {
    return false
  }

  if (!isBrowser()) return false

  const normalized = normalizeProducts(products)
  if (!normalized.length) return false

  const payload = {
    products: normalized,
    filters:
      Array.isArray(filters) && filters.length ? filters : deriveFiltersFromProducts(normalized),
    updatedAt: new Date().toISOString(),
  }

  window.localStorage.setItem(TEAM_PRODUCTS_STORAGE_KEY, JSON.stringify(payload))
  return true
}

export function clearTeamProductsStorage() {
  if (!isBrowser()) return
  window.localStorage.removeItem(TEAM_PRODUCTS_STORAGE_KEY)
}

export async function getProductsData() {
  if (USE_DJANGO_API) {
    try {
      return await getProductsFromDjango()
    } catch (error) {
      console.warn('[productsService] Django API fetch failed:', error)
      return {
        products: [],
        filters: deriveFiltersFromProducts([]),
        source: 'django-error',
      }
    }
  }

  const teamData = getTeamProductsFromStorage()
  if (teamData) return teamData

  const sanityProjectId = import.meta.env.VITE_SANITY_PROJECT_ID
  const sanityDataset = import.meta.env.VITE_SANITY_DATASET
  const sanityApiVersion = import.meta.env.VITE_SANITY_API_VERSION || '2024-01-01'

  if (sanityProjectId && sanityDataset) {
    try {
      const query = '*[_type == "product"]{slug, category, title, description, details, price, image{asset->{url}}}'
      const sanityUrl = `https://${sanityProjectId}.api.sanity.io/v${sanityApiVersion}/data/query/${sanityDataset}?query=${encodeURIComponent(query)}`
      const response = await fetch(sanityUrl)
      if (!response.ok) throw new Error(`Sanity request failed: ${response.status}`)

      const payload = await response.json()
      const sanityProducts = normalizeProducts(
        (payload?.result || []).map((item) => ({
          ...item,
          slug: item?.slug?.current || item?.slug,
          image: item?.image?.asset?.url || item?.image,
          price: item?.price,
        })),
      )

      if (!sanityProducts.length) {
        throw new Error('Sanity payload has no valid products')
      }

      return {
        products: sanityProducts,
        filters: deriveFiltersFromProducts(sanityProducts),
        source: 'sanity',
      }
    } catch (error) {
      console.warn('[productsService] Falling back from Sanity:', error)
    }
  }

  const cmsProductsUrl = import.meta.env.VITE_CMS_PRODUCTS_URL

  if (!cmsProductsUrl) {
    return { products: localProducts, filters: localFilters, source: 'local' }
  }

  try {
    const response = await fetch(cmsProductsUrl)
    if (!response.ok) throw new Error(`CMS request failed: ${response.status}`)

    const payload = await response.json()
    const remoteProducts = normalizeProducts(Array.isArray(payload) ? payload : payload.products)

    if (!remoteProducts.length) {
      throw new Error('CMS payload has no valid products')
    }

    const remoteFilters =
      Array.isArray(payload?.filters) && payload.filters.length
        ? payload.filters
        : deriveFiltersFromProducts(remoteProducts)

    return { products: remoteProducts, filters: remoteFilters, source: 'cms' }
  } catch (error) {
    console.warn('[productsService] Falling back to local products:', error)
    return { products: localProducts, filters: localFilters, source: 'local-fallback' }
  }
}

export async function saveTeamProducts(products) {
  try {
    if (USE_DJANGO_API) {
      const ok = await upsertProductsToDjango(products)
      return { ok, source: 'django' }
    }

    const ok = saveTeamProductsToStorage(products)
    return { ok, source: 'team-storage' }
  } catch (error) {
    console.warn('[productsService] Save failed:', error)
    return { ok: false, source: USE_DJANGO_API ? 'django' : 'team-storage' }
  }
}
