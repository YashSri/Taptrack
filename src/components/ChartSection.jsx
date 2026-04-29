import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

ChartJS.register(
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
)

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#dbeafe',
        usePointStyle: true,
        pointStyle: 'circle',
      },
    },
  },
  scales: {
    x: {
      ticks: { color: 'rgba(219, 234, 254, 0.72)' },
      grid: { color: 'rgba(255,255,255,0.06)' },
    },
    y: {
      beginAtZero: true,
      ticks: {
        color: 'rgba(219, 234, 254, 0.72)',
        precision: 0,
      },
      grid: { color: 'rgba(255,255,255,0.06)' },
    },
  },
}

function ChartSection({ records, groupedByDate }) {
  if (records.length === 0) {
    return (
      <section className="glass rounded-[30px] p-6">
        <p className="text-xs uppercase tracking-[0.35em] text-blue-100/70">
          Analytics
        </p>
        <h3 className="mt-3 text-2xl font-semibold text-white">
          Attendance trends
        </h3>
        <div className="mt-6 rounded-[24px] border border-white/10 bg-white/6 px-4 py-10 text-center text-sm text-blue-50/76">
          No attendance records yet
        </div>
      </section>
    )
  }

  const barData = {
    labels: ['Tap In', 'Tap Out'],
    datasets: [
      {
        label: 'Attendance Count',
        data: [
          records.filter((record) => record.type === 'tap_in').length,
          records.filter((record) => record.type === 'tap_out').length,
        ],
        backgroundColor: ['rgba(52, 211, 153, 0.65)', 'rgba(96, 165, 250, 0.65)'],
        borderRadius: 14,
      },
    ],
  }

  const sortedDates = Object.keys(groupedByDate).sort(
    (first, second) => new Date(first) - new Date(second),
  )

  const lineData = {
    labels: sortedDates,
    datasets: [
      {
        label: 'Tap In',
        data: sortedDates.map((date) => groupedByDate[date].tapIn),
        borderColor: 'rgba(52, 211, 153, 1)',
        backgroundColor: 'rgba(52, 211, 153, 0.14)',
        fill: true,
        tension: 0.35,
      },
      {
        label: 'Tap Out',
        data: sortedDates.map((date) => groupedByDate[date].tapOut),
        borderColor: 'rgba(96, 165, 250, 1)',
        backgroundColor: 'rgba(96, 165, 250, 0.12)',
        fill: true,
        tension: 0.35,
      },
    ],
  }

  return (
    <section className="glass rounded-[30px] p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-blue-100/70">
          Analytics
        </p>
        <h3 className="mt-3 text-2xl font-semibold text-white">
          Daily attendance trend
        </h3>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[24px] border border-white/10 bg-slate-950/18 p-4">
          <p className="mb-4 text-sm font-medium text-blue-50/76">
            Total tap comparison
          </p>
          <div className="h-72">
            <Bar data={barData} options={chartOptions} />
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-slate-950/18 p-4">
          <p className="mb-4 text-sm font-medium text-blue-50/76">
            Daily attendance trend
          </p>
          <div className="h-72">
            <Line data={lineData} options={chartOptions} />
          </div>
        </div>
      </div>
    </section>
  )
}

export default ChartSection
