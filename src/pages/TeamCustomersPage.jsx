import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Footer from '../components/Footer'
import TeamNavbar from '../components/TeamNavbar'
import { createCustomer, getCustomersData } from '../services/customersService'

const defaultForm = {
  full_name: '',
  phone: '',
  email: '',
  city: '',
  business_name: '',
  customer_type: 'recurring',
  contact_preference: 'phone',
  notes: '',
  follow_up_flag: false,
}

function formatDate(value) {
  if (!value) return 'No job yet'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'No job yet'
  return parsed.toLocaleDateString('en-NG', { dateStyle: 'medium' })
}

function titleCase(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function TeamCustomersPage() {
  const [customers, setCustomers] = useState([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(defaultForm)
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false)
  const [visibleDirectoryCount, setVisibleDirectoryCount] = useState(8)

  async function loadCustomers() {
    setLoading(true)
    try {
      const data = await getCustomersData()
      setCustomers(data.customers)
    } catch (error) {
      setStatus(`Failed to load customers: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((item) => {
      return (
        String(item.full_name || '').toLowerCase().includes(q) ||
        String(item.phone || '').toLowerCase().includes(q) ||
        String(item.email || '').toLowerCase().includes(q) ||
        String(item.business_name || '').toLowerCase().includes(q)
      )
    })
  }, [customers, query])

  const segmentStats = useMemo(() => {
    const walkIn = customers.filter((item) => item.customer_type === 'walk_in').length
    const recurring = customers.filter((item) => item.customer_type === 'recurring').length
    const premium = customers.filter((item) => item.customer_type === 'premium').length
    const followUp = customers.filter((item) => item.follow_up_flag).length
    return { walkIn, recurring, premium, followUp }
  }, [customers])

  const spotlightCustomers = useMemo(() => {
    return [...customers]
      .filter((item) => item.customer_type !== 'walk_in')
      .sort((a, b) => {
        const aTime = a?.last_job_date ? new Date(a.last_job_date).getTime() : 0
        const bTime = b?.last_job_date ? new Date(b.last_job_date).getTime() : 0
        return bTime - aTime
      })
      .slice(0, 6)
  }, [customers])

  const visibleDirectoryCustomers = useMemo(() => {
    if (query.trim()) return filtered
    return filtered.slice(0, visibleDirectoryCount)
  }, [filtered, query, visibleDirectoryCount])

  const hasMoreDirectoryCustomers = !query.trim() && visibleDirectoryCount < filtered.length

  useEffect(() => {
    if (query.trim()) {
      setIsDirectoryOpen(true)
    }
    setVisibleDirectoryCount(8)
  }, [query])

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.full_name.trim()) {
      setStatus('Customer name is required.')
      return
    }

    try {
      const created = await createCustomer({
        ...form,
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        city: form.city.trim(),
        business_name: form.business_name.trim(),
        notes: form.notes.trim(),
      })
      setCustomers((current) => [created, ...current])
      setForm(defaultForm)
      setStatus('Customer added successfully.')
    } catch (error) {
      setStatus(`Could not create customer: ${error.message}`)
    }
  }

  return (
    <>
      <TeamNavbar />
      <main className="bg-[#F4F8FC]">
        <section className="relative overflow-hidden bg-gradient-to-br from-[#102848] via-[#17365d] to-[#214672] py-10 text-white">
          <div className="pointer-events-none absolute -left-8 top-6 h-28 w-28 bg-yellow/20 blur-3xl" />
          <div className="pointer-events-none absolute right-8 top-10 h-24 w-24 bg-white/10 blur-3xl" />
          <div className="container-shell relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow">
              Customers
            </p>
            <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">
              Add, find, and follow up with customers.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-100 sm:text-base">
              Search customers fast, see their last job, and mark people to follow up.
            </p>
          </div>
        </section>

        <section className="container-shell py-8 md:py-10">
          {status ? (
            <div className="mb-6 border border-navy/20 bg-navy/5 px-4 py-3 text-sm text-slate-700 shadow-sm">
              {status}
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <section className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  New Customer
                </p>
                <h2 className="mt-1 text-2xl font-extrabold text-navy">Add Customer</h2>
              </div>

              <form onSubmit={handleCreate} className="mt-6 space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Full name
                    <input
                      className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                      placeholder="Customer full name"
                      value={form.full_name}
                      onChange={(e) => setForm((curr) => ({ ...curr, full_name: e.target.value }))}
                    />
                  </label>

                  <label className="block text-sm font-semibold text-slate-700">
                    Phone
                    <input
                      className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                      placeholder="080..."
                      value={form.phone}
                      onChange={(e) => setForm((curr) => ({ ...curr, phone: e.target.value }))}
                    />
                  </label>

                  <label className="block text-sm font-semibold text-slate-700">
                    Email
                    <input
                      className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                      placeholder="Optional"
                      value={form.email}
                      onChange={(e) => setForm((curr) => ({ ...curr, email: e.target.value }))}
                    />
                  </label>

                  <label className="block text-sm font-semibold text-slate-700">
                    City
                    <input
                      className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                      placeholder="Optional"
                      value={form.city}
                      onChange={(e) => setForm((curr) => ({ ...curr, city: e.target.value }))}
                    />
                  </label>

                  <label className="block text-sm font-semibold text-slate-700">
                    Business name
                    <input
                      className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                      placeholder="Optional"
                      value={form.business_name}
                      onChange={(e) => setForm((curr) => ({ ...curr, business_name: e.target.value }))}
                    />
                  </label>

                  <label className="block text-sm font-semibold text-slate-700">
                    Customer segment
                    <select
                      className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                      value={form.customer_type}
                      onChange={(e) => setForm((curr) => ({ ...curr, customer_type: e.target.value }))}
                    >
                      <option value="walk_in">Walk-in</option>
                      <option value="recurring">Recurring</option>
                      <option value="premium">Premium / Project</option>
                    </select>
                  </label>

                  <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                    Contact preference
                    <select
                      className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                      value={form.contact_preference}
                      onChange={(e) => setForm((curr) => ({ ...curr, contact_preference: e.target.value }))}
                    >
                      <option value="phone">Phone</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">Email</option>
                    </select>
                  </label>
                </div>

                <label className="block text-sm font-semibold text-slate-700">
                  Notes
                  <textarea
                    className="mt-2 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                    rows={4}
                    placeholder="Preferences, payment behavior, material choices, follow-up notes..."
                    value={form.notes}
                    onChange={(e) => setForm((curr) => ({ ...curr, notes: e.target.value }))}
                  />
                </label>

                <label className="flex items-center gap-2 border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.follow_up_flag}
                    onChange={(e) => setForm((curr) => ({ ...curr, follow_up_flag: e.target.checked }))}
                  />
                  Mark this customer for follow-up
                </label>

                <div className="flex justify-end">
                  <button className="btn-primary w-full sm:w-auto" type="submit">Save Customer</button>
                </div>
              </form>
            </section>

            <section className="space-y-6">
              <div className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Customer Summary
                </p>
                <h2 className="mt-1 text-2xl font-extrabold text-navy">Overview</h2>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <ValueCard label="Walk-in Records" value={segmentStats.walkIn} />
                  <ValueCard label="Recurring Customers" value={segmentStats.recurring} />
                  <ValueCard label="Premium Clients" value={segmentStats.premium} />
                  <ValueCard label="Follow-up Flags" value={segmentStats.followUp} />
                </div>
              </div>

              <div className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Recent Customers
                    </p>
                    <h2 className="mt-1 text-2xl font-extrabold text-navy">Customer List</h2>
                  </div>
                  {loading ? <span className="text-sm text-slate-500">Loading...</span> : null}
                </div>

                <div className="mt-4">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-navy"
                    placeholder="Search by name, phone, email, or business"
                  />
                </div>

                <div className="mt-5 space-y-3">
                  {spotlightCustomers.length ? (
                    spotlightCustomers.map((customer) => (
                      <div key={customer.id} className="border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900">{customer.full_name}</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {customer.business_name || customer.phone || 'No business or phone added'}
                            </p>
                          </div>
                          <span className="border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                            {titleCase(customer.customer_type)}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                          <span className="border border-slate-200 bg-white px-2 py-1">
                            Last job: {formatDate(customer.last_job_date)}
                          </span>
                          <span className="border border-slate-200 bg-white px-2 py-1">
                            Orders: {customer.ordersCount}
                          </span>
                          {customer.follow_up_flag ? (
                            <span className="border border-yellow/50 bg-yellow/10 px-2 py-1 text-yellow-800">
                              Follow-up
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      No customer profiles available yet.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          <section className="mt-8 border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <button
              type="button"
              onClick={() => setIsDirectoryOpen((current) => !current)}
              className="flex w-full flex-col items-start gap-3 text-left sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  All Customers
                </p>
                <h2 className="mt-1 text-2xl font-extrabold text-navy">Full Customer List</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Open this when you want to see every customer in one list.
                </p>
              </div>

              <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                <span className="border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-600">
                  {filtered.length} customer{filtered.length === 1 ? '' : 's'}
                </span>
                <span
                  className={`flex h-10 w-10 items-center justify-center border border-slate-300 bg-white text-slate-500 transition ${
                    isDirectoryOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                >
                  <ChevronDown size={18} />
                </span>
              </div>
            </button>

            {isDirectoryOpen ? (
              <>
                <div className="mt-5 flex flex-col gap-2 border-t border-slate-200 pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    Showing {visibleDirectoryCustomers.length} of {filtered.length} customer
                    {filtered.length === 1 ? '' : 's'}.
                  </p>
                  {query.trim() ? (
                    <p>Search is active, so matching results are fully expanded.</p>
                  ) : (
                    <p>Use the search box above for faster lookup instead of scrolling.</p>
                  )}
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {filtered.length ? (
                    visibleDirectoryCustomers.map((item) => (
                      <article key={item.id} className="border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-extrabold text-slate-900">{item.full_name}</h3>
                            <p className="mt-1 text-sm text-slate-500">
                              {item.business_name || 'No business name added'}
                            </p>
                          </div>
                          <span className="border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                            {titleCase(item.customer_type)}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <InfoCell label="Phone" value={item.phone || '-'} />
                          <InfoCell label="Email" value={item.email || '-'} />
                          <InfoCell label="City" value={item.city || '-'} />
                          <InfoCell label="Contact" value={titleCase(item.contact_preference || '-')} />
                          <InfoCell label="Last Job" value={formatDate(item.last_job_date)} />
                          <InfoCell label="Orders" value={String(item.ordersCount)} />
                        </div>

                        {item.notes ? (
                          <div className="mt-4 border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                            {item.notes}
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                          <span className={`border px-2 py-1 ${
                            item.isReturningCustomer
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                              : 'border-slate-300 bg-slate-50 text-slate-600'
                          }`}>
                            {item.isReturningCustomer ? 'Returning customer' : 'First-time / low history'}
                          </span>
                          {item.follow_up_flag ? (
                            <span className="border border-yellow/50 bg-yellow/10 px-2 py-1 text-yellow-800">
                              Follow-up flagged
                            </span>
                          ) : null}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 lg:col-span-2">
                      No customers match your search.
                    </div>
                  )}
                </div>

                {hasMoreDirectoryCustomers ? (
                  <div className="mt-5 flex justify-center border-t border-slate-200 pt-4">
                    <button
                      type="button"
                      onClick={() => setVisibleDirectoryCount((current) => current + 8)}
                      className="w-full border border-navy px-4 py-3 text-sm font-semibold text-navy transition hover:bg-navy hover:text-white sm:w-auto"
                    >
                      Show 8 More Customers
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="mt-5 border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                The full customer directory is collapsed to keep this page easier to scan. Expand it when you need detailed browsing.
              </div>
            )}
          </section>
        </section>
      </main>
      <Footer />
    </>
  )
}

function ValueCard({ label, value }) {
  return (
    <div className="border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
    </div>
  )
}

function InfoCell({ label, value }) {
  return (
    <div className="border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  )
}

export default TeamCustomersPage
