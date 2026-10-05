import { useEffect, useState } from 'react'
import { getMyAttendance, recordMyAttendance } from '../services/staffService'

function formatTime(value) {
  return value ? new Date(value).toLocaleString('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not recorded'
}

export default function StaffAttendance() {
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    getMyAttendance().then((data) => { if (active) setRecord(data) })
      .catch((error) => { if (active) setMessage(error.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function submit(action) {
    setSaving(true)
    setMessage('')
    try {
      setRecord(await recordMyAttendance(action))
      setMessage(action === 'sign-in' ? 'Signed in. Your arrival time has been recorded.' : 'Signed out. Your leaving time has been recorded.')
    } catch (error) {
      setMessage(typeof error.payload?.[0] === 'string' ? error.payload[0] : error.message)
      try { setRecord(await getMyAttendance()) } catch { /* Keep the last known attendance. */ }
    } finally { setSaving(false) }
  }

  return <section className="mb-5 border border-slate-200 bg-white p-5">
    <h2 className="text-lg font-extrabold text-navy">Daily attendance</h2>
    <p className="mt-1 text-sm text-slate-600">Sign in when you arrive and sign out when you leave. Times are recorded automatically in WAT.</p>
    {record?.date ? <p className="mt-2 text-sm text-slate-500">Attendance day: {record.date}</p> : null}
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <p className="text-sm">Time resumed (WAT): <strong>{formatTime(record?.resumed_at)}</strong></p>
      <p className="text-sm">Time leaving (WAT): <strong>{formatTime(record?.left_at)}</strong></p>
    </div>
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" className="btn-primary min-h-[44px] disabled:opacity-50" disabled={loading || saving || Boolean(record?.resumed_at)} onClick={() => submit('sign-in')}>Sign in</button>
      <button type="button" className="btn-primary min-h-[44px] disabled:opacity-50" disabled={loading || saving || !record?.resumed_at || Boolean(record?.left_at)} onClick={() => submit('sign-out')}>Sign out</button>
    </div>
    {loading ? <p className="mt-3 text-sm">Loading attendance...</p> : null}
    {message ? <p role="status" className="mt-3 text-sm text-slate-700">{message}</p> : null}
  </section>
}
