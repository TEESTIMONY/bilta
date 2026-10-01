// Compact page title for the Team CMS: a plain heading, one short line, and optional
// controls (a date picker or main action) on the right.
function TeamPageHeader({ title, subtitle, children }) {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="container-shell flex flex-col gap-3 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-navy sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        {children ? <div className="flex flex-wrap items-end gap-2">{children}</div> : null}
      </div>
    </section>
  )
}

export default TeamPageHeader
