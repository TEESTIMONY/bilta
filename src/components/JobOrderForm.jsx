import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { createCustomer } from '../services/customersService'
import { createJob, ensureWalkInCustomer } from '../services/ordersService'

const projectJobTypes = [
  'printing',
  'branding',
  'large_format',
  'design',
  'binding',
  'packaging',
  'event_production',
  'book_printing',
]

const emptyItem = () => ({ key: `${Date.now()}-${Math.random()}`, description: '', quantity: '1', rate: '' })

const defaultForm = {
  kind: 'walk_in',
  customerName: '',
  phone: '',
  address: '',
  dateNeeded: '',
  fulfilment: 'pickup',
  agreedTotal: '',
  discountReason: '',
  amountPaid: '',
  notes: '',
  jobType: 'printing',
  projectScopeNote: '',
}

const inputClass =
  'mt-1.5 w-full border border-slate-300 bg-white px-3 py-2.5 text-[15px] outline-none transition focus:border-navy'

function formatCurrency(value) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(
    Number(value || 0),
  )
}

function titleCase(value) {
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

// 0803 123 4567, +2348031234567 and 2348031234567 all become 8031234567.
function phoneKey(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('234')) return digits.slice(3)
  if (digits.startsWith('0')) return digits.slice(1)
  return digits
}

function JobOrderForm({ customers = [], onCreated, onError }) {
  const [form, setForm] = useState(defaultForm)
  const [items, setItems] = useState([emptyItem()])
  const [submitting, setSubmitting] = useState(false)
  const isProject = form.kind === 'project'

  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }))

  const matchedCustomer = useMemo(() => {
    const key = phoneKey(form.phone)
    if (key.length < 7) return null
    return customers.find((customer) => phoneKey(customer.phone) === key) || null
  }, [customers, form.phone])

  const lineAmounts = items.map((item) => Math.max(1, Number(item.quantity || 0)) * Number(item.rate || 0))
  const total = lineAmounts.reduce((sum, amount) => sum + amount, 0)
  const hasDiscount = form.agreedTotal !== ''
  const agreed = hasDiscount ? Number(form.agreedTotal) : total
  const discount = Math.max(0, total - agreed)
  const paid = Number(form.amountPaid || 0)
  const balance = Math.max(0, agreed - paid)
  const discountInvalid = hasDiscount && (Number.isNaN(agreed) || agreed > total || agreed < paid)

  function updateItem(key, field, value) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, [field]: value } : item)))
  }

  function removeItem(key) {
    setItems((current) => (current.length > 1 ? current.filter((item) => item.key !== key) : current))
  }

  async function resolveCustomerId() {
    if (matchedCustomer) return matchedCustomer.id

    const name = form.customerName.trim()
    const phone = form.phone.trim()
    if (!name && !phone) {
      if (isProject) throw new Error('Add the customer name for contract and project jobs.')
      const walkIn = await ensureWalkInCustomer()
      return walkIn.id
    }

    const created = await createCustomer({
      full_name: name || 'Walk-in Customer',
      phone,
      address: form.address.trim(),
      customer_type: isProject ? 'premium' : 'walk_in',
    })
    return created.id
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const filled = items.filter((item) => item.description.trim() || item.rate)
    if (!filled.length) {
      onError?.('Add at least one item: what the customer wants, how many, and the rate.')
      return
    }
    const incomplete = filled.find(
      (item) => !item.description.trim() || !(Number(item.quantity) >= 1) || !(Number(item.rate) > 0),
    )
    if (incomplete) {
      onError?.('Each item needs a description, a quantity of at least 1, and a rate above ₦0.')
      return
    }
    if (discountInvalid) {
      onError?.(`The discounted price must be between ${formatCurrency(paid)} (paid now) and ${formatCurrency(total)} (total).`)
      return
    }

    setSubmitting(true)
    try {
      const customer = await resolveCustomerId()
      const created = await createJob({
        customer,
        job_type: isProject ? form.jobType : 'walk_in',
        status: 'pending',
        fulfilment: form.fulfilment,
        deadline: form.dateNeeded ? new Date(`${form.dateNeeded}T17:00`).toISOString() : null,
        items: filled.map((item) => ({
          description: item.description.trim(),
          quantity: Math.max(1, Number(item.quantity)),
          rate: String(Number(item.rate)),
        })),
        amount_paid: String(paid),
        special_instructions: form.notes.trim(),
        project_scope_note: isProject ? form.projectScopeNote.trim() : '',
        ...(hasDiscount ? { agreed_total: String(agreed), discount_reason: form.discountReason.trim() } : {}),
      })

      setForm((current) => ({ ...defaultForm, kind: current.kind }))
      setItems([emptyItem()])
      await onCreated?.(`Job #${created.id} saved.`)
    } catch (error) {
      onError?.(error.message || 'Could not save the job.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-2 gap-2">
        {[
          { value: 'walk_in', label: 'Walk-in job' },
          { value: 'project', label: 'Contract / project' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setForm((current) => ({ ...current, kind: option.value }))}
            className={`min-h-[44px] border px-3 text-sm font-semibold transition ${
              form.kind === option.value
                ? 'border-navy bg-navy text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:border-navy hover:text-navy'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <fieldset>
        <legend className="text-sm font-bold text-navy">Customer details</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">
            Customer {isProject ? '' : <span className="font-normal text-slate-500">(optional)</span>}
            <input value={form.customerName} onChange={set('customerName')} className={inputClass} placeholder="Name" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Phone {isProject ? '' : <span className="font-normal text-slate-500">(optional)</span>}
            <input type="tel" value={form.phone} onChange={set('phone')} className={inputClass} placeholder="080..." />
          </label>
          <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
            Address <span className="font-normal text-slate-500">(optional)</span>
            <input value={form.address} onChange={set('address')} className={inputClass} placeholder="For delivery" />
          </label>
        </div>
        {matchedCustomer ? (
          <p className="mt-2 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Returning customer: <span className="font-bold">{matchedCustomer.full_name}</span>. This job will be added to
            their record.
          </p>
        ) : !isProject && !form.customerName.trim() && !form.phone.trim() ? (
          <p className="mt-2 text-sm text-slate-500">Leave blank for a quick walk-in job.</p>
        ) : null}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700">
          Date needed
          <input type="date" value={form.dateNeeded} onChange={set('dateNeeded')} className={inputClass} />
        </label>
        <div className="text-sm font-semibold text-slate-700">
          Pickup or delivery
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {['pickup', 'delivery'].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm((current) => ({ ...current, fulfilment: value }))}
                className={`min-h-[44px] border px-3 text-sm font-semibold transition ${
                  form.fulfilment === value
                    ? 'border-navy bg-navy text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-navy'
                }`}
              >
                {titleCase(value)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-bold text-navy">Items</legend>
        <div className="mt-2 hidden grid-cols-[2rem_1fr_5rem_7rem_7rem_2.75rem] gap-2 px-1 text-xs font-semibold text-slate-500 md:grid">
          <span>#</span>
          <span>Job type / description</span>
          <span>Qty</span>
          <span>Rate (₦)</span>
          <span className="text-right">Amount</span>
          <span />
        </div>
        <div className="mt-1 space-y-2">
          {items.map((item, index) => (
            <div
              key={item.key}
              className="grid grid-cols-[1fr_1fr_2.75rem] gap-2 border border-slate-200 bg-slate-50 p-2 md:grid-cols-[2rem_1fr_5rem_7rem_7rem_2.75rem] md:items-center md:border-0 md:bg-transparent md:p-0"
            >
              <span className="hidden text-sm text-slate-500 md:block">{index + 1}</span>
              <input
                value={item.description}
                onChange={(e) => updateItem(item.key, 'description', e.target.value)}
                className={`${inputClass} col-span-3 mt-0 md:col-span-1`}
                placeholder={`Item ${index + 1}, e.g. A4 flyers, full colour`}
                aria-label={`Item ${index + 1} description`}
              />
              <label className="block text-xs font-semibold text-slate-500">
                <span className="md:sr-only">Qty</span>
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.key, 'quantity', e.target.value)}
                  className={`${inputClass} mt-1 md:mt-0`}
                  placeholder="Qty"
                  aria-label={`Item ${index + 1} quantity`}
                />
              </label>
              <label className="block text-xs font-semibold text-slate-500">
                <span className="md:sr-only">Rate (₦)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={item.rate}
                  onChange={(e) => updateItem(item.key, 'rate', e.target.value)}
                  className={`${inputClass} mt-1 md:mt-0`}
                  placeholder="Rate ₦"
                  aria-label={`Item ${index + 1} rate`}
                />
              </label>
              <span className="col-span-2 self-center text-sm font-bold text-slate-900 md:col-span-1 md:text-right">
                <span className="font-normal text-slate-500 md:hidden">Amount: </span>
                {formatCurrency(lineAmounts[index])}
              </span>
              <button
                type="button"
                onClick={() => removeItem(item.key)}
                disabled={items.length === 1}
                className="flex h-11 w-11 items-center justify-center border border-slate-300 bg-white text-slate-500 transition hover:border-red-300 hover:text-red-600 disabled:opacity-30"
                aria-label={`Remove item ${index + 1}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setItems((current) => [...current, emptyItem()])}
          className="mt-2 inline-flex min-h-[44px] items-center gap-2 border border-dashed border-slate-400 px-4 text-sm font-semibold text-navy transition hover:border-navy"
        >
          <Plus size={16} /> Add item
        </button>
      </fieldset>

      <div className="space-y-3 border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between text-base">
          <span className="font-semibold text-slate-700">Total</span>
          <span className="font-extrabold text-slate-900">{formatCurrency(total)}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">
            Discounted price <span className="font-normal text-slate-500">(optional)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.agreedTotal}
              onChange={set('agreedTotal')}
              className={inputClass}
              placeholder="What the customer will pay"
            />
          </label>
          {hasDiscount ? (
            <label className="block text-sm font-semibold text-slate-700">
              Reason for discount
              <input value={form.discountReason} onChange={set('discountReason')} className={inputClass} placeholder="e.g. Bulk order" />
            </label>
          ) : null}
          <label className="block text-sm font-semibold text-slate-700">
            Amount paid now <span className="font-normal text-slate-500">(optional)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.amountPaid}
              onChange={set('amountPaid')}
              className={inputClass}
              placeholder="0"
            />
          </label>
        </div>

        {hasDiscount && discountInvalid ? (
          <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            The discounted price must be between {formatCurrency(paid)} (paid now) and {formatCurrency(total)} (total).
          </p>
        ) : null}

        {hasDiscount && !discountInvalid && discount > 0 ? (
          <div className="flex items-center justify-between text-sm text-emerald-800">
            <span>Discount</span>
            <span className="font-bold">-{formatCurrency(discount)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base">
          <span className="font-semibold text-slate-700">Balance to pay</span>
          <span className="font-extrabold text-navy">{formatCurrency(discountInvalid ? total - paid : balance)}</span>
        </div>
      </div>

      <label className="block text-sm font-semibold text-slate-700">
        Notes <span className="font-normal text-slate-500">(optional)</span>
        <textarea
          value={form.notes}
          onChange={set('notes')}
          className={inputClass}
          rows={2}
          placeholder="Colours, finishing, delivery instructions..."
        />
      </label>

      {isProject ? (
        <div className="space-y-3 border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-bold text-navy">Contract / project details</p>
          <label className="block text-sm font-semibold text-slate-700">
            Job type
            <select value={form.jobType} onChange={set('jobType')} className={inputClass}>
              {projectJobTypes.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Project scope
            <textarea
              value={form.projectScopeNote}
              onChange={set('projectScopeNote')}
              className={inputClass}
              rows={4}
              placeholder="What's agreed: deliverables, stages, references, contacts..."
            />
          </label>
        </div>
      ) : null}

      <button type="submit" disabled={submitting} className="btn-primary min-h-[48px] w-full disabled:cursor-not-allowed disabled:opacity-60">
        {submitting ? 'Saving...' : 'Save job'}
      </button>
    </form>
  )
}

export default JobOrderForm
