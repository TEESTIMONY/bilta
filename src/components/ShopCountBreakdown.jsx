import { countResult } from '../utils/cashCount'

const currency = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })

function ShopCountBreakdown({ counts = [], payments = [], sessions = [], loading = false }) {
  const count = counts[0]
  const result = count ? countResult(count) : null
  return <section className="border border-slate-200 bg-white p-5">
    <h2 className="text-lg font-extrabold text-navy">Shop cash and transfer count</h2>
    <p className="mt-1 text-sm text-slate-600">One combined total for the whole shop, before expenses.</p>
    {loading ? <p className="mt-3 text-sm">Loading...</p> : count ? <div className="mt-4 space-y-2 text-sm">
      <p>Cash: <strong>{currency.format(count.cashAmount)}</strong></p>
      <p>Transfers: <strong>{currency.format(count.transferAmount)}</strong></p>
      <p>Total counted: <strong>{currency.format(count.countedTotal)}</strong></p>
      <p>Recorded collections: <strong>{currency.format(count.recordedTotal)}</strong></p>
      <p className={`border p-2 font-semibold ${result.tone === 'ok' ? 'border-emerald-200 text-emerald-800' : 'border-amber-300 text-amber-900'}`}>{result.label}</p>
      {count.note ? <p className="whitespace-pre-wrap">Note: {count.note}</p> : null}
    </div> : <p className="mt-4 text-sm text-slate-500">No shop count entered for this day.</p>}
    <details className="mt-4 border-t border-slate-200 pt-3">
      <summary className="cursor-pointer text-sm font-semibold">Recorded shop collections</summary>
      <ul className="mt-2 space-y-2 text-sm">
        {payments.map((payment) => <li key={`payment-${payment.id}`} className="flex justify-between gap-3"><span>{payment.jobId ? `Job #${payment.jobId}` : payment.serviceLabel || 'Payment'}</span><strong>{currency.format(payment.amount)}</strong></li>)}
        {sessions.map((session) => <li key={`copy-${session.id}`} className="flex justify-between gap-3"><span>Photocopy session</span><strong>{currency.format(session.actualCashCollected)}</strong></li>)}
        {!payments.length && !sessions.length ? <li>No collections recorded.</li> : null}
      </ul>
    </details>
  </section>
}

export default ShopCountBreakdown
