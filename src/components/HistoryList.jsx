const formatDate = (timestamp) =>
  new Date(timestamp).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

const formatTime = (timestamp) =>
  new Date(timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })

function HistoryList({ records, isLoading }) {
  return (
    <section className="glass rounded-[30px] p-6">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-blue-100/70">
            Attendance History
          </p>
          <h3 className="mt-3 text-2xl font-semibold text-white">
            Tap logs in real time
          </h3>
        </div>
        <p className="text-sm text-blue-50/70">
          {records.length} {records.length === 1 ? 'entry' : 'entries'}
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-10 text-center text-sm text-blue-50/76">
          Fetching attendance history...
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-10 text-center text-sm text-blue-50/76">
          No attendance records yet
        </div>
      ) : (
        <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
          {records.map((record) => {
            const isTapIn = record.type === 'tap_in'

            return (
              <article
                key={record.id}
                className="rounded-[24px] border border-white/10 bg-slate-950/18 px-4 py-4 transition duration-300 hover:scale-[1.01] hover:border-blue-200/24 hover:bg-slate-950/24"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                          isTapIn
                            ? 'bg-emerald-400/12 text-emerald-100'
                            : 'bg-blue-400/12 text-blue-100'
                        }`}
                      >
                        {isTapIn ? 'Tap In' : 'Tap Out'}
                      </span>
                      <span className="text-sm text-blue-50/66">
                        {formatDate(record.createdAt)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-blue-50/76">
                      Recorded at {formatTime(record.createdAt)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm text-blue-50/74 sm:min-w-[16rem]">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-blue-100/55">
                        Distance
                      </p>
                      <p className="mt-2 font-medium text-white">
                        {record.distance} m
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-blue-100/55">
                        Coordinates
                      </p>
                      <p className="mt-2 font-medium text-white">
                        {record.latitude.toFixed(4)}, {record.longitude.toFixed(4)}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default HistoryList
