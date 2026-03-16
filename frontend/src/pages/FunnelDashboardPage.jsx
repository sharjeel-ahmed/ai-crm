import { useEffect, useState } from 'react';
import {
  Calendar,
  Filter,
  Megaphone,
  Plus,
  Save,
  Target,
  ThumbsDown,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../api/client';
import { formatDate } from '../utils/dateFormat';
import { useAuth } from '../context/AuthContext';

const fmt = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(n || 0);

function SectionTitle({ icon: Icon, iconTone, title, text }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconTone}`}>
        <Icon size={20} />
      </div>
      <div>
        <h3 className="text-xl font-semibold text-stone-900">{title}</h3>
        <p className="text-sm text-stone-500">{text}</p>
      </div>
    </div>
  );
}

const barColors = ['#0f766e', '#0369a1', '#7c3aed', '#ea580c', '#dc2626', '#525252'];

export default function FunnelDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [targetForm, setTargetForm] = useState({ user_id: '', period: new Date().toISOString().slice(0, 7), target_value: '' });
  const [reps, setReps] = useState([]);
  const [myDeals, setMyDeals] = useState(() => localStorage.getItem('myDealsFilter') === 'true');
  const toggleMyDeals = (v) => { localStorage.setItem('myDealsFilter', v); setMyDeals(v); };

  useEffect(() => {
    setData(null);
    const q = myDeals ? '?my_deals=true' : '';
    api.get(`/reports/funnel-dashboard${q}`).then((r) => setData(r.data));
    if (user?.role === 'admin' || user?.role === 'manager') {
      api.get('/deals/owners').then((r) => setReps(r.data));
    }
  }, [user?.role, myDeals]);

  function saveTarget(e) {
    e.preventDefault();
    api.post('/reports/targets', {
      user_id: parseInt(targetForm.user_id),
      period: targetForm.period,
      target_value: parseFloat(targetForm.target_value),
    }).then(() => {
      setShowTargetForm(false);
      setTargetForm({ user_id: '', period: new Date().toISOString().slice(0, 7), target_value: '' });
      api.get('/reports/funnel-dashboard').then((r) => setData(r.data));
    });
  }

  if (!data) {
    return <div className="rounded-[2rem] border border-stone-200 bg-white p-12 text-center text-stone-500">Loading funnel dashboard...</div>;
  }

  const { forecastByMonth, closingSoon, conversionRates, funnelStages, leadSourceConversion, lostDeals, quotaTracking, currentMonth } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-[radial-gradient(circle_at_top_right,#ede9fe_0,#ffffff_34%,#ecfeff_100%)] shadow-sm">
        <div className="px-6 py-7">
          <div className="flex items-center justify-between">
            <div className="text-sm uppercase tracking-[0.28em] text-stone-500">Funnel Dashboard</div>
            {user?.role !== 'sales_rep' && (
              <div className="flex items-center rounded-lg border border-stone-200 bg-stone-50 p-0.5">
                <button
                  onClick={() => toggleMyDeals(false)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${!myDeals ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  All Deals
                </button>
                <button
                  onClick={() => toggleMyDeals(true)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${myDeals ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  My Deals
                </button>
              </div>
            )}
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">Pipeline flow, conversion, and forecast</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
            Understand how deals move through stages, where they drop off, which sources convert best,
            and whether your team is on track to hit targets.
          </p>
        </div>
      </div>

      {/* Row 1: Forecast + Closing Soon */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        {/* Forecast by month chart */}
        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <SectionTitle
            icon={Calendar}
            iconTone="bg-orange-50 text-orange-700"
            title="Revenue Forecast"
            text="Expected close dates grouped by month — raw pipeline vs weighted forecast."
          />
          {forecastByMonth.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-stone-200 p-6 text-sm text-stone-500">
              No deals have expected close dates set. Set close dates on active deals to enable forecasting.
            </div>
          ) : (
            <>
              <div className="mt-6 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={forecastByMonth}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => `${Math.round(v / 100000)}L`} />
                    <Tooltip formatter={(value, name) => [fmt(value), name === 'raw_value' ? 'Raw Pipeline' : 'Weighted Forecast']} />
                    <Bar dataKey="raw_value" name="Raw Pipeline" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="weighted_value" name="Weighted Forecast" fill="#0d9488" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {forecastByMonth.map((m) => (
                  <div key={m.month} className="rounded-2xl bg-stone-50 p-3">
                    <div className="text-xs text-stone-400">{m.month}</div>
                    <div className="mt-1 text-sm font-semibold text-stone-900">{fmt(m.weighted_value)}</div>
                    <div className="text-xs text-stone-500">{m.deal_count} deals &bull; {fmt(m.raw_value)} raw</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Closing soon deals */}
        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <SectionTitle
            icon={Calendar}
            iconTone="bg-amber-50 text-amber-700"
            title="Closing This Month"
            text="Deals with expected close dates in the next 30 days — pressure-test the forecast."
          />
          <div className="mt-5 space-y-3 max-h-[520px] overflow-y-auto">
            {closingSoon.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 p-6 text-sm text-stone-500">
                No deals have expected close dates in the next 30 days.
              </div>
            ) : closingSoon.map((deal) => (
              <div key={deal.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-stone-900">{deal.title}</div>
                    <div className="mt-1 text-xs text-stone-500">
                      {deal.company_name || 'No company'} &bull; {deal.owner_name || 'Unassigned'} &bull; {deal.stage_name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-stone-950">{fmt(deal.value)}</div>
                    <div className="text-xs text-stone-500">{deal.win_probability}% prob</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-stone-600">
                  <span>Closes {formatDate(deal.expected_close)}</span>
                  <span className="font-medium text-teal-700">Weighted: {fmt(deal.value * deal.win_probability / 100)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Conversion Funnel + Lead Source Conversion */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        {/* Stage conversion funnel */}
        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <SectionTitle
            icon={Filter}
            iconTone="bg-indigo-50 text-indigo-700"
            title="Stage Conversion Funnel"
            text="How deals flow through the pipeline — spot bottlenecks where conversion drops."
          />

          {/* Visual funnel */}
          {funnelStages && funnelStages.length > 0 && (
            <div className="mt-6 space-y-2">
              {funnelStages.map((stage, i) => {
                const maxEntered = funnelStages[0]?.entered || 1;
                const widthPct = Math.max(20, Math.round((stage.entered / maxEntered) * 100));
                return (
                  <div key={stage.stage} className="flex items-center gap-3">
                    <div className="w-24 text-right text-sm font-medium text-stone-700">{stage.stage}</div>
                    <div className="flex-1">
                      <div
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-white"
                        style={{ width: `${widthPct}%`, backgroundColor: barColors[i % barColors.length] }}
                      >
                        <span className="font-medium">{stage.entered}</span>
                        <span className="text-xs opacity-80">{stage.deal_count} current</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Conversion rates */}
          <div className="mt-6 space-y-4">
            {conversionRates.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 p-6 text-sm text-stone-500">Not enough data.</div>
            ) : conversionRates.map((step) => (
              <div key={`${step.from}-${step.to}`}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-stone-800">{step.from} &rarr; {step.to}</span>
                  <span className={`font-semibold ${step.rate >= 50 ? 'text-emerald-700' : step.rate >= 25 ? 'text-amber-700' : 'text-rose-700'}`}>
                    {step.rate}%
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-stone-500">
                  <span>{step.from_count} entered</span>
                  <span>&rarr;</span>
                  <span>{step.to_count} progressed</span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={`h-full rounded-full ${step.rate >= 50 ? 'bg-emerald-500' : step.rate >= 25 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.max(4, step.rate)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lead source conversion */}
        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <SectionTitle
            icon={Megaphone}
            iconTone="bg-pink-50 text-pink-700"
            title="Lead Source Conversion"
            text="Which sources produce deals and which ones actually close — better marketing insight."
          />
          <div className="mt-5 space-y-4">
            {leadSourceConversion.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 p-6 text-sm text-stone-500">No lead source data available.</div>
            ) : leadSourceConversion.map((source) => (
              <div key={source.source} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-stone-900">{source.source}</div>
                    <div className="mt-1 flex gap-3 text-xs text-stone-500">
                      <span>{source.total_deals} total</span>
                      <span className="text-emerald-600">{source.won_deals} won</span>
                      <span className="text-rose-600">{source.lost_deals} lost</span>
                      <span>{source.open_deals} open</span>
                    </div>
                  </div>
                  <div className="text-right">
                    {source.win_rate !== null ? (
                      <>
                        <div className={`text-sm font-semibold ${source.win_rate >= 50 ? 'text-emerald-700' : source.win_rate >= 25 ? 'text-amber-700' : 'text-rose-700'}`}>
                          {source.win_rate}% win rate
                        </div>
                        <div className="text-xs text-stone-500">{fmt(source.won_value)} won</div>
                      </>
                    ) : (
                      <div className="text-xs text-stone-400">No closed deals</div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex gap-1">
                  {source.won_deals > 0 && (
                    <div className="h-2 rounded-full bg-emerald-500" style={{ flex: source.won_deals }} />
                  )}
                  {source.open_deals > 0 && (
                    <div className="h-2 rounded-full bg-sky-400" style={{ flex: source.open_deals }} />
                  )}
                  {source.lost_deals > 0 && (
                    <div className="h-2 rounded-full bg-rose-400" style={{ flex: source.lost_deals }} />
                  )}
                </div>
                <div className="mt-2 flex gap-4 text-[10px] text-stone-400">
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />Won</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-sky-400" />Open</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-rose-400" />Lost</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Lost Deal Breakdown + Quota Tracking */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        {/* Lost deal breakdown */}
        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <SectionTitle
            icon={ThumbsDown}
            iconTone="bg-rose-50 text-rose-700"
            title="Lost Deal Breakdown"
            text="Understand why and where deals are being lost to drive coaching and process improvements."
          />

          {/* Summary cards */}
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-stone-50 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-stone-400">Total Lost</div>
              <div className="mt-2 text-2xl font-semibold text-stone-950">{lostDeals.summary.total_lost}</div>
            </div>
            <div className="rounded-2xl bg-stone-50 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-stone-400">Value Lost</div>
              <div className="mt-2 text-2xl font-semibold text-stone-950">{fmt(lostDeals.summary.total_lost_value)}</div>
            </div>
            <div className="rounded-2xl bg-stone-50 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-stone-400">Avg Days to Loss</div>
              <div className="mt-2 text-2xl font-semibold text-stone-950">{lostDeals.summary.avg_days_to_loss}d</div>
            </div>
          </div>

          {/* By value band */}
          {lostDeals.byValue.length > 0 && (
            <div className="mt-5">
              <div className="text-sm font-medium text-stone-700 mb-3">By Deal Size</div>
              <div className="space-y-2">
                {lostDeals.byValue.map((band) => (
                  <div key={band.band} className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-2">
                    <span className="text-sm text-stone-700">{band.band}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-stone-500">{band.count} deals</span>
                      <span className="font-medium text-stone-900">{fmt(band.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By rep */}
          {lostDeals.byRep.length > 0 && (
            <div className="mt-5">
              <div className="text-sm font-medium text-stone-700 mb-3">By Rep</div>
              <div className="space-y-2">
                {lostDeals.byRep.map((rep) => (
                  <div key={rep.name} className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-2">
                    <span className="text-sm text-stone-700">{rep.name || 'Unassigned'}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-stone-500">{rep.lost_count} deals</span>
                      <span className="font-medium text-rose-700">{fmt(rep.lost_value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent lost deals */}
          {lostDeals.recent.length > 0 && (
            <div className="mt-5">
              <div className="text-sm font-medium text-stone-700 mb-3">Recent Losses</div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {lostDeals.recent.map((deal) => (
                  <div key={deal.id} className="rounded-2xl border border-stone-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-stone-900">{deal.title}</div>
                        <div className="mt-1 text-xs text-stone-500">
                          {deal.company_name || 'No company'} &bull; {deal.owner_name || 'Unassigned'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-stone-900">{fmt(deal.value)}</div>
                        <div className="text-xs text-stone-500">{deal.days_to_loss}d cycle</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quota/target tracking */}
        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <SectionTitle
              icon={Target}
              iconTone="bg-teal-50 text-teal-700"
              title="Quota Tracking"
              text={`Target attainment for ${currentMonth} — set monthly targets per rep.`}
            />
            {(user?.role === 'admin' || user?.role === 'manager') && (
              <button
                onClick={() => setShowTargetForm(!showTargetForm)}
                className="flex items-center gap-1 rounded-xl bg-stone-100 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-200 transition-colors"
              >
                {showTargetForm ? <X size={16} /> : <Plus size={16} />}
                {showTargetForm ? 'Cancel' : 'Set Target'}
              </button>
            )}
          </div>

          {/* Target form */}
          {showTargetForm && (
            <form onSubmit={saveTarget} className="mt-4 rounded-2xl border border-stone-200 p-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Rep</label>
                  <select
                    value={targetForm.user_id}
                    onChange={(e) => setTargetForm({ ...targetForm, user_id: e.target.value })}
                    required
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select rep...</option>
                    {reps.filter(r => r.role !== 'admin').map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Period</label>
                  <input
                    type="month"
                    value={targetForm.period}
                    onChange={(e) => setTargetForm({ ...targetForm, period: e.target.value })}
                    required
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Target Value</label>
                  <input
                    type="number"
                    value={targetForm.target_value}
                    onChange={(e) => setTargetForm({ ...targetForm, target_value: e.target.value })}
                    placeholder="e.g., 500000"
                    required
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
              >
                <Save size={16} />
                Save Target
              </button>
            </form>
          )}

          {/* Quota cards */}
          <div className="mt-5 space-y-3">
            {quotaTracking.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 p-6 text-center">
                <div className="text-sm text-stone-500">No targets set for {currentMonth}.</div>
                {(user?.role === 'admin' || user?.role === 'manager') && (
                  <div className="mt-2 text-xs text-stone-400">Click "Set Target" above to assign monthly quotas to reps.</div>
                )}
              </div>
            ) : quotaTracking.map((rep) => (
              <div key={rep.user_id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-stone-900">{rep.name}</div>
                    <div className="mt-1 text-xs text-stone-500">{rep.won_count} deals won this month</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${rep.attainment >= 100 ? 'text-emerald-700' : rep.attainment >= 50 ? 'text-amber-700' : 'text-rose-700'}`}>
                      {rep.attainment}%
                    </div>
                    <div className="text-xs text-stone-500">attainment</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-stone-600">
                  <span>Actual: {fmt(rep.actual)}</span>
                  <span>Target: {fmt(rep.target)}</span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={`h-full rounded-full transition-all ${rep.attainment >= 100 ? 'bg-emerald-500' : rep.attainment >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(100, rep.attainment)}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-stone-500">
                  {rep.attainment >= 100
                    ? `Exceeded target by ${fmt(rep.actual - rep.target)}`
                    : `${fmt(rep.target - rep.actual)} remaining`
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
