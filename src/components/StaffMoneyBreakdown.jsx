import { useMemo } from 'react'

function formatCurrency(value) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(
    Number(value || 0),
  )
}

// For the owner: the day's money in, with how much each staff member took
// (their payments plus their photocopy cash).
function StaffMoneyBreakdown({ payments = [], sessions = [], title = 'Money in, by staff', loading = false }) {
  const rows = useMemo(() => {
    const map = new Map()
    const rowFor = (id, name) => {
      const key = id ?? `name:${name || 'Unknown'}`
      if (!map.has(key)) map.set(key, { key, name: name || 'Unknown', payments: 0, paymentCount: 0, copies: 0 })
      return map.get(key)
    }
    for (const payment of payments) {
      const row = rowFor(payment.recordedById, payment.recordedByName)
      row.payments += Number(payment.amount || 0)
      row.paymentCount += 1
    }
    for (const session of sessions) {
      rowFor(session.staffId, session.staffName).copies += Number(session.actualCashCollected || 0)
    }
    return [...map.values()]
      .map((row) => ({ ...row, total: row.payments + row.copies }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  }, [payments, sessions])

  const total = rows.reduce((sum, row) => sum + row.total, 0)

  return (
    <section className="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-extrabold text-navy">{title}</h2>
        <p className="text-lg font-extrabold text-slate-900">{formatCurrency(total)}</p>
      </div>
      {rows.length ? (
        <ul className="mt-2 divide-y divide-slate-200">
          {rows.map((row) => (
            <li key={row.key} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{row.name}</p>
                <p className="text-sm text-slate-600">
                  {row.paymentCount} payment{row.paymentCount === 1 ? '' : 's'} {formatCurrency(row.payments)}
                  {row.copies ? ` · photocopies ${formatCurrency(row.copies)}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold text-slate-900">{formatCurrency(row.total)}</p>
                <p className="text-xs text-slate-500">{total ? Math.round((row.total / total) * 100) : 0}%</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{loading ? 'Loading...' : 'No money recorded yet.'}</p>
      )}
    </section>
  )
}

export default StaffMoneyBreakdown
