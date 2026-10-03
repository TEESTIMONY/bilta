import { useCallback, useEffect, useState } from 'react'
import { getCashCounts, saveCashCount } from '../services/operationsService'
import { countResult } from '../utils/cashCount'

const inputClass =
  'mt-1.5 w-full min-h-[44px] border border-slate-300 bg-white px-3 text-[15px] outline-none transition focus:border-navy'

function formatCurrency(value) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(
    Number(value || 0),
  )
}

function formatTime(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })
}

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// End-of-day cash-up on the Today page: the signed-in person enters the cash and transfers
// they actually collected, and it's checked against what they recorded in the CMS.
function EndOfDayCount({ userId, refreshKey = 0 }) {
  const [count, setCount] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ cash: '', transfer: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const { counts } = await getCashCounts(todayKey())
      setCount(counts.find((item) => item.staffId === userId) || null)
    } catch {
      setCount(null)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  function startEditing() {
    setForm({
      cash: count ? String(count.cashAmount) : '',
      transfer: count ? String(count.transferAmount) : '',
      note: count?.note || '',
    })
    setError('')
    setEditing(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (form.cash === '' && form.transfer === '') {
      setError('Enter the cash and transfers you collected (use 0 if none).')
      return
    }
    if (Number(form.cash) < 0 || Number(form.transfer) < 0) {
      setError('Amounts cannot be negative.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const saved = await saveCashCount({ cashAmount: form.cash, transferAmount: form.transfer, note: form.note.trim() })
      setCount(saved)
      setEditing(false)
    } catch (saveError) {
      setError(`Could not save the count: ${saveError.message}`)
    } finally {
      setSaving(false)
    }
  }

  const result = count ? countResult(count) : null
  const resultClass =
    result?.tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : result?.tone === 'short'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-amber-200 bg-amber-50 text-amber-800'

  return (
    <section id="end-of-day" className="mt-5 border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-navy">End of day count</h2>
          <p className="mt-1 text-sm text-slate-600">
            {count
              ? `Counted at ${formatTime(count.updatedAt)}.`
              : 'Before you leave, count the cash and transfers you collected today.'}
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={startEditing}
            className={`min-h-[44px] px-4 text-sm font-semibold ${
              count ? 'border border-slate-300 bg-white text-slate-700 hover:border-navy' : 'btn-primary'
            }`}
          >
            {count ? 'Recount' : 'Count now'}
          </button>
        ) : null}
      </div>

      {count && !editing ? (
        <div className="mt-4 space-y-2">
          <p className="text-[15px] text-slate-800">
            Cash <span className="font-bold">{formatCurrency(count.cashAmount)}</span> + transfers{' '}
            <span className="font-bold">{formatCurrency(count.transferAmount)}</span> ={' '}
            <span className="font-bold">{formatCurrency(count.countedTotal)}</span>
          </p>
          <p className="text-[15px] text-slate-800">
            Recorded in the CMS: <span className="font-bold">{formatCurrency(count.recordedTotal)}</span>
          </p>
          <p className={`border px-3 py-2 text-sm font-semibold ${resultClass}`}>
            {result.tone === 'ok'
              ? '✓ Matches the CMS.'
              : `${result.label}: please recount, and check every payment was recorded. The owner can see this.`}
          </p>
          {count.note ? <p className="text-sm text-slate-600">Note: {count.note}</p> : null}
        </div>
      ) : null}

      {editing ? (
        <form onSubmit={handleSave} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              Cash collected
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.cash}
                onChange={(e) => setForm((current) => ({ ...current, cash: e.target.value }))}
                className={inputClass}
                placeholder="0"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Transfers collected
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={form.transfer}
                onChange={(e) => setForm((current) => ({ ...current, transfer: e.target.value }))}
                className={inputClass}
                placeholder="0"
              />
            </label>
          </div>
          <p className="text-sm text-slate-600">
            Total counted: <span className="font-bold">{formatCurrency(Number(form.cash || 0) + Number(form.transfer || 0))}</span>
          </p>
          <label className="block text-sm font-semibold text-slate-700">
            Note <span className="font-normal text-slate-500">(optional)</span>
            <input
              value={form.note}
              onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))}
              className={inputClass}
              placeholder="e.g. N500 change given from my own money"
            />
          </label>
          {error ? <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" disabled={saving} className="btn-primary min-h-[44px] w-full disabled:opacity-60 sm:w-auto">
              {saving ? 'Saving...' : 'Save count'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-[44px] border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}

export default EndOfDayCount
