import { useEffect, useState } from 'react';
import api from '../api/client';
import { formatDate } from '../utils/dateFormat';
import {
  AlertTriangle,
  CalendarRange,
  Clock3,
  Filter,
  Gauge,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const presets = [
  { value: 'last_week', label: 'Last Week' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'custom', label: 'Custom Range' },
];

const sentimentStyles = {
  positive: 'bg-emerald-100 text-emerald-700',
  negative: 'bg-rose-100 text-rose-700',
  neutral: 'bg-slate-100 text-slate-700',
};

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPresetDates(preset) {
  const end = new Date();
  const start = new Date(end);

  if (preset === 'last_month') {
    start.setDate(start.getDate() - 29);
  } else if (preset === 'last_quarter') {
    start.setDate(start.getDate() - 89);
  } else {
    start.setDate(start.getDate() - 6);
  }

  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
  };
}

function MetricCard({ icon: Icon, label, value, subtext, accent = 'text-sky-600' }) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 ${accent}`}>
          <Icon size={20} />
        </div>
        <span className="text-xs uppercase tracking-[0.22em] text-stone-400">{label}</span>
      </div>
      <div className="mt-5 text-3xl font-semibold text-stone-900">{value}</div>
      <div className="mt-2 text-sm text-stone-500">{subtext}</div>
    </div>
  );
}

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function ReportsPage() {
  const defaultDates = getPresetDates('last_week');
  const [preset, setPreset] = useState('last_week');
  const [startDate, setStartDate] = useState(defaultDates.startDate);
  const [endDate, setEndDate] = useState(defaultDates.endDate);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [pipelineData, setPipelineData] = useState([]);
  const [repData, setRepData] = useState([]);
  const [agingData, setAgingData] = useState([]);
  const [attentionData, setAttentionData] = useState([]);

  useEffect(() => {
    if (preset === 'custom') return;
    const dates = getPresetDates(preset);
    setStartDate(dates.startDate);
    setEndDate(dates.endDate);
  }, [preset]);

  useEffect(() => {
    if (!startDate || !endDate) return;

    const params = preset === 'custom'
      ? { start_date: startDate, end_date: endDate, preset }
      : { start_date: startDate, end_date: endDate, preset };

    setLoading(true);
    Promise.all([
      api.get('/reports/summary', { params }),
      api.get('/reports/pipeline-value', { params }),
      api.get('/reports/rep-performance', { params }),
      api.get('/reports/deal-aging', { params }),
      api.get('/reports/attention', { params }),
    ]).then(([summaryRes, pipelineRes, repRes, agingRes, attentionRes]) => {
      setSummary(summaryRes.data);
      setPipelineData(pipelineRes.data);
      setRepData(repRes.data);
      setAgingData(agingRes.data);
      setAttentionData(attentionRes.data);
    }).finally(() => setLoading(false));
  }, [preset, startDate, endDate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-stone-200 bg-[linear-gradient(135deg,#ffffff_0%,#f5f3ff_45%,#eef6ff_100%)] p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.24em] text-stone-500">Revenue Reporting</div>
          <h2 className="mt-2 text-3xl font-semibold text-stone-900">Sales progress that stays usable as data grows</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
            Focus the reporting window, inspect current pipeline health, coach reps with outcome metrics,
            and surface deals that need intervention before they stall.
          </p>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white/90 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <Filter size={16} />
            Report Window
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className="rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {presets.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setPreset('custom'); setStartDate(e.target.value); }}
              className="rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setPreset('custom'); setEndDate(e.target.value); }}
              className="rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>
      </div>

      {loading || !summary ? (
        <div className="rounded-3xl border border-stone-200 bg-white p-12 text-center text-stone-500">Loading reports...</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={TrendingUp}
              label="New Pipeline"
              value={fmt(summary.newPipelineValue)}
              subtext={`${summary.newDeals} new deals opened in range`}
              accent="text-sky-600"
            />
            <MetricCard
              icon={Trophy}
              label="Won In Period"
              value={fmt(summary.wonValue)}
              subtext={`${summary.wonDeals} deals closed won`}
              accent="text-emerald-600"
            />
            <MetricCard
              icon={Target}
              label="Win Rate"
              value={`${Math.round(summary.winRate || 0)}%`}
              subtext={`${summary.lostDeals} lost deals, ${summary.avgSalesCycleDays} day avg cycle`}
              accent="text-violet-600"
            />
            <MetricCard
              icon={Gauge}
              label="Open Pipeline"
              value={fmt(summary.activePipelineValue)}
              subtext={`${summary.activePipelineDeals} active deals right now`}
              accent="text-amber-600"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-stone-900">Pipeline Progress by Stage</h3>
                  <p className="mt-1 text-sm text-stone-500">How deal creation is distributing across the funnel in the selected period.</p>
                </div>
                <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                  {formatDate(summary.range.start_date)} to {formatDate(summary.range.end_date)}
                </div>
              </div>
              <div className="mt-6 h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="stage" />
                    <YAxis tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v, name) => [name === 'value' ? fmt(v) : v, name === 'value' ? 'Value' : 'Deals']} />
                    <Legend />
                    <Bar dataKey="value" name="value" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="count" name="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-stone-900">Needs Attention</h3>
                  <p className="text-sm text-stone-500">Stalled, inactive, or negative-sentiment deals worth reviewing now.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-2xl bg-stone-50 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-stone-400">Stale Deals</div>
                  <div className="mt-2 text-3xl font-semibold text-stone-900">{summary.staleDeals}</div>
                </div>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-stone-400">No Activity In Range</div>
                  <div className="mt-2 text-3xl font-semibold text-stone-900">{summary.inactiveDeals}</div>
                </div>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-stone-400">Avg Sales Cycle</div>
                  <div className="mt-2 text-3xl font-semibold text-stone-900">{summary.avgSalesCycleDays}d</div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {attentionData.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-stone-200 p-6 text-sm text-stone-500">No active deals need escalation right now.</div>
                ) : attentionData.map((deal) => (
                  <div key={deal.id} className="rounded-2xl border border-stone-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-stone-900">{deal.title}</div>
                        <div className="mt-1 text-xs text-stone-500">
                          {deal.company_name || 'No company'} • {deal.owner_name || 'Unassigned'} • {deal.stage_name}
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sentimentStyles[deal.sentiment || 'neutral']}`}>
                        {deal.sentiment || 'neutral'}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-600">
                      <span>{fmt(deal.value)}</span>
                      <span>{deal.days_in_stage} days in stage</span>
                      <span>{deal.no_recent_activity ? 'No recent activity' : `Last activity ${formatDate(deal.last_activity_at)}`}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-stone-900">Rep Performance</h3>
                  <p className="text-sm text-stone-500">Best-practice coaching view: pipeline creation, wins, open book, and speed to close.</p>
                </div>
              </div>

              <div className="mt-6 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={repData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v, name) => [name === 'won_value' || name === 'open_value' ? fmt(v) : v, name === 'won_value' ? 'Won Value' : 'Open Pipeline']} />
                    <Legend />
                    <Bar dataKey="won_value" name="won_value" fill="#10b981" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="open_value" name="open_value" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full divide-y divide-stone-200">
                  <thead className="bg-stone-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Rep</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">New Deals</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Won</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Win Rate</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Avg Cycle</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-stone-500">Open Book</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {repData.map((rep) => {
                      const closed = rep.won_deals + rep.lost_deals;
                      const winRate = closed > 0 ? Math.round((rep.won_deals / closed) * 100) : 0;
                      return (
                        <tr key={rep.user_id}>
                          <td className="px-4 py-4 text-sm font-medium text-stone-900">{rep.name}</td>
                          <td className="px-4 py-4 text-sm text-stone-600">{rep.total_deals}</td>
                          <td className="px-4 py-4 text-sm font-medium text-emerald-600">{fmt(rep.won_value)}</td>
                          <td className="px-4 py-4 text-sm text-stone-600">{closed > 0 ? `${winRate}%` : '-'}</td>
                          <td className="px-4 py-4 text-sm text-stone-600">{rep.avg_cycle_days ? `${rep.avg_cycle_days}d` : '-'}</td>
                          <td className="px-4 py-4 text-sm text-amber-700">{fmt(rep.open_value)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                  <Clock3 size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-stone-900">Stage Aging</h3>
                  <p className="text-sm text-stone-500">Use this to spot bottlenecks and where leadership intervention is most needed.</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {agingData.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-stone-200 p-6 text-sm text-stone-500">No open deals in the current reporting window.</div>
                ) : agingData.map((stage) => (
                  <div key={stage.stage} className="rounded-2xl border border-stone-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-stone-900">{stage.stage}</div>
                        <div className="mt-1 text-xs text-stone-500">{stage.deal_count} active deal(s)</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-stone-900">{stage.avg_days}d avg</div>
                        <div className="text-xs text-stone-500">{stage.max_days}d max</div>
                      </div>
                    </div>
                    <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className={`rounded-full ${stage.avg_days >= 21 ? 'bg-rose-500' : stage.avg_days >= 10 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, Math.max(12, stage.avg_days * 3))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                <CalendarRange size={20} />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-stone-900">How to use this view</h3>
                <p className="text-sm text-stone-500">
                  SaaS sales teams typically review period creation, win quality, aging, and rep mix together. That combination tells you if the top of funnel is healthy, whether deals are converting, and where management attention should go first.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
