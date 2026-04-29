function StatsCard({ label, value, accent = 'blue', helper }) {
  const accents = {
    blue: 'from-blue-300/30 via-blue-400/10 to-transparent text-blue-50',
    emerald:
      'from-emerald-300/30 via-emerald-400/10 to-transparent text-emerald-50',
    slate: 'from-slate-200/25 via-white/8 to-transparent text-blue-50',
  }

  return (
    <article className="glass relative overflow-hidden rounded-[28px] p-5">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accents[accent]}`}
      />
      <div className="relative">
        <p className="text-xs uppercase tracking-[0.3em] text-blue-100/72">
          {label}
        </p>
        <p className="mt-4 text-4xl font-semibold text-white">{value}</p>
        {helper ? (
          <p className="mt-3 text-sm leading-6 text-blue-50/72">{helper}</p>
        ) : null}
      </div>
    </article>
  )
}

export default StatsCard
