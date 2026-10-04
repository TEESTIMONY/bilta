// Shared by the Today page's end-of-day count and the owner's Reports.
const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })

// How an end-of-day count compares with what the CMS recorded: matches, short or over.
export function countResult(count) {
  const diff = Number(count?.difference || 0)
  if (Math.abs(diff) < 0.005) return { tone: 'ok', label: 'Matches the CMS' }
  return diff < 0
    ? { tone: 'short', label: `${naira.format(-diff)} short` }
    : { tone: 'over', label: `${naira.format(diff)} over` }
}
