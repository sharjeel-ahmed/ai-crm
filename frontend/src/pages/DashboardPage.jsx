import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  Gauge,
  IndianRupee,
  KanbanSquare,
  Orbit,
  ShieldAlert,
  Sparkles,
  Timer,
  Trophy,
  Users,
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

const sentimentStyles = {
  positive: 'bg-emerald-100 text-emerald-700',
  negative: 'bg-rose-100 text-rose-700',
  neutral: 'bg-stone-100 text-stone-700',
};

const stageBarColors = ['#0f766e', '#0369a1', '#7c3aed', '#ea580c', '#dc2626', '#525252'];

function DeltaBadge({ delta }) {
  if (delta === null || delta === undefined) return null;
  const isPositive = delta >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
      {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(delta)}%
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, subtext, accent, tone, delta }) {
  return (
    <div className={`rounded-[1.75rem] border p-5 shadow-sm ${tone}`}>
      <div className="flex items-center justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${accent}`}>
          <Icon size={20} />
        </div>
        <span className="text-xs uppercase tracking-[0.24em] text-stone-400">{label}</span>
      </div>
      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-stone-950">{value}</span>
        <DeltaBadge delta={delta} />
      </div>
      <div className="mt-2 text-sm text-stone-600">{subtext}</div>
    </div>
  );
}

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

const fmt = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(n || 0);

export default function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/reports/dashboard').then((response) => setData(response.data));
  }, []);

  if (!data) {
    return <div className="rounded-[2rem] border border-stone-200 bg-white p-12 text-center text-stone-500">Loading dashboard...</div>;
  }

  const { snapshot, movement, stageHealth, leadSources, repLeaderboard, attention, recentActivities, avgSalesCycleDays } = data;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-[radial-gradient(circle_at_top_left,#fff7ed_0,#ffffff_34%,#ecfeff_100%)] shadow-sm">
        <div className="grid gap-8 px-6 py-7 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="text-sm uppercase tracking-[0.28em] text-stone-500">Management Dashboard</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">A live operating view of revenue motion</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
              Use this page for the current state of the business: open pipeline quality, near-term execution,
              rep momentum, and deals that need intervention before they drift.
            </p>
          </div>

          <div className="grid gap-4 rounded-[1.75rem] border border-stone-200 bg-white/80 p-5 backdrop-blur md:grid-cols-4">
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-stone-400">Open Book</div>
              <div className="mt-2 text-2xl font-semibold text-stone-950">{fmt(snapshot.openValue)}</div>
              <div className="mt-1 text-sm text-stone-500">{snapshot.openDeals} active deals</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-stone-400">Forecast</div>
              <div className="mt-2 text-2xl font-semibold text-teal-700">{fmt(snapshot.weightedPipelineValue)}</div>
              <div className="mt-1 text-sm text-stone-500">weighted by stage probability</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-stone-400">Wins, 30 Days</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-stone-950">{fmt(movement.wonValueLast30Days)}</span>
                <DeltaBadge delta={movement.wonValueDelta} />
              </div>
              <div className="mt-1 text-sm text-stone-500">{movement.wonDealsLast30Days} deals won</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.22em] text-stone-400">At Risk</div>
              <div className="mt-2 text-2xl font-semibold text-stone-950">{snapshot.staleDeals + snapshot.noActivityLast7Days}</div>
              <div className="mt-1 text-sm text-stone-500">stale or inactive signals</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          icon={KanbanSquare}
          label="Open Pipeline"
          value={fmt(snapshot.openValue)}
          subtext={`Forecast: ${fmt(snapshot.weightedPipelineValue)} weighted by probability`}
          accent="bg-sky-50 text-sky-700"
          tone="border-stone-200 bg-white"
        />
        <MetricCard
          icon={Trophy}
          label="Win Rate"
          value={`${Math.round(movement.winRateLast30Days || 0)}%`}
          subtext={`${movement.wonDealsLast30Days} won and ${movement.lostDealsLast30Days} lost in the last 30 days`}
          accent="bg-emerald-50 text-emerald-700"
          tone="border-stone-200 bg-white"
          delta={movement.winRateDelta}
        />
        <MetricCard
          icon={Sparkles}
          label="New Demand"
          value={fmt(movement.newValueLast7Days)}
          subtext={`${movement.newDealsLast7Days} new deals opened in the last 7 days`}
          accent="bg-violet-50 text-violet-700"
          tone="border-stone-200 bg-white"
          delta={movement.newValueDelta}
        />
        <MetricCard
          icon={Timer}
          label="Avg Cycle Time"
          value={`${avgSalesCycleDays}d`}
          subtext="Average days from deal creation to close-won"
          accent="bg-teal-50 text-teal-700"
          tone="border-stone-200 bg-white"
        />
        <MetricCard
          icon={Orbit}
          label="New Leads"
          value={movement.newLeadsLast7Days}
          subtext={`${fmt(movement.newLeadValueLast7Days)} created in Lead stage over the last 7 days`}
          accent="bg-amber-50 text-amber-700"
          tone="border-stone-200 bg-white"
          delta={movement.newDealsDelta}
        />
        <MetricCard
          icon={ShieldAlert}
          label="Negative Sentiment"
          value={snapshot.negativeSentimentDeals}
          subtext={`${snapshot.noActivityLast7Days} open deals had no activity in the last 7 days`}
          accent="bg-rose-50 text-rose-700"
          tone="border-stone-200 bg-white"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <SectionTitle
            icon={Gauge}
            iconTone="bg-cyan-50 text-cyan-700"
            title="Stage Health"
            text="Management best practice is to watch where value is stacking up and where cycle time is stretching."
          />
          <div className="mt-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageHealth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="stage" />
                <YAxis tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} />
                <Tooltip
                  formatter={(value, name) => [name === 'deal_value' ? fmt(value) : value, name === 'deal_value' ? 'Pipeline Value' : 'Deals']}
                />
                <Bar dataKey="deal_value" radius={[10, 10, 0, 0]}>
                  {stageHealth.map((_, index) => <Cell key={index} fill={stageBarColors[index % stageBarColors.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {stageHealth.map((stage) => (
              <div key={stage.stage} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-stone-900">{stage.stage}</span>
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">{stage.win_probability}%</span>
                    </div>
                    <div className="mt-1 text-xs text-stone-500">{stage.deal_count} active deal(s)</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-stone-900">{fmt(stage.deal_value)}</div>
                    <div className="text-xs text-teal-600">Wtd: {fmt(stage.weighted_value)}</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-stone-600">
                  <span>{stage.avg_days_in_stage}d avg age</span>
                  <span>{stage.negative_deals} neg. sentiment</span>
                  <span>{stage.max_days_in_stage}d max</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={`${stage.avg_days_in_stage >= 21 ? 'bg-rose-500' : stage.avg_days_in_stage >= 10 ? 'bg-amber-500' : 'bg-emerald-500'} h-full rounded-full`}
                    style={{ width: `${Math.min(100, Math.max(10, stage.avg_days_in_stage * 3))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <SectionTitle
            icon={AlertTriangle}
            iconTone="bg-rose-50 text-rose-700"
            title="Needs Attention"
            text="The highest priority deals blend aging, inactivity, sentiment risk, and deal value."
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-2xl bg-stone-50 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-stone-400">Stale Deals</div>
              <div className="mt-2 text-3xl font-semibold text-stone-950">{snapshot.staleDeals}</div>
            </div>
            <div className="rounded-2xl bg-stone-50 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-stone-400">No Activity 7d</div>
              <div className="mt-2 text-3xl font-semibold text-stone-950">{snapshot.noActivityLast7Days}</div>
            </div>
            <div className="rounded-2xl bg-stone-50 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-stone-400">Negative Sentiment</div>
              <div className="mt-2 text-3xl font-semibold text-stone-950">{snapshot.negativeSentimentDeals}</div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {attention.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 p-6 text-sm text-stone-500">No open deals are currently flagged for escalation.</div>
            ) : attention.map((deal) => (
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
                  <span>{deal.no_recent_activity ? 'No activity in 7 days' : `Last activity ${formatDate(deal.last_activity_at)}`}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
          <SectionTitle
            icon={Users}
            iconTone="bg-emerald-50 text-emerald-700"
            title="Team Snapshot"
            text="This is the management coaching layer: who is carrying pipeline, who is closing, and who has risk building up."
          />

          <div className="mt-5 space-y-3">
            {repLeaderboard.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 p-6 text-sm text-stone-500">No rep data available yet.</div>
            ) : repLeaderboard.map((rep, index) => (
              <div key={rep.user_id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-sm font-semibold text-stone-700">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-stone-900">{rep.name}</div>
                      <div className="mt-1 text-xs text-stone-500">{rep.open_deals} active deal(s)</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-stone-950">{fmt(rep.won_value_last_30)}</div>
                    <div className="text-xs text-stone-500">won in 30 days</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl bg-stone-50 p-3">
                    <div className="text-stone-400">Open Book</div>
                    <div className="mt-1 font-semibold text-stone-900">{fmt(rep.open_value)}</div>
                  </div>
                  <div className="rounded-xl bg-stone-50 p-3">
                    <div className="text-stone-400">Wins 30d</div>
                    <div className="mt-1 font-semibold text-stone-900">{rep.won_last_30}</div>
                  </div>
                  <div className="rounded-xl bg-stone-50 p-3">
                    <div className="text-stone-400">At Risk</div>
                    <div className={`mt-1 font-semibold ${rep.at_risk_open > 0 ? 'text-rose-600' : 'text-stone-900'}`}>{rep.at_risk_open}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <SectionTitle
              icon={ArrowUpRight}
              iconTone="bg-violet-50 text-violet-700"
              title="Recent Momentum"
              text="A quick read on whether pipeline generation and conversion are moving in the right direction."
            />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-stone-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                  <IndianRupee size={16} />
                  New Pipeline, 7 Days
                </div>
                <div className="mt-3 text-3xl font-semibold text-stone-950">{fmt(movement.newValueLast7Days)}</div>
                <div className="mt-1 text-sm text-stone-500">{movement.newDealsLast7Days} deals opened</div>
              </div>
              <div className="rounded-2xl bg-stone-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                  <Trophy size={16} />
                  Closed Won, 30 Days
                </div>
                <div className="mt-3 text-3xl font-semibold text-stone-950">{fmt(movement.wonValueLast30Days)}</div>
                <div className="mt-1 text-sm text-stone-500">{movement.wonDealsLast30Days} wins</div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-stone-900">Lead Intake</div>
                  <div className="mt-1 text-xs text-stone-500">
                    {snapshot.leadStageDeals} deals are currently sitting in the Lead stage
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-stone-950">{fmt(snapshot.leadStageValue)}</div>
                  <div className="text-xs text-stone-500">current lead-stage value</div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {leadSources.length === 0 ? (
                  <div className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-500">No lead-source activity in the last 30 days.</div>
                ) : leadSources.map((source) => (
                  <div key={source.source}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-stone-800">{source.source}</span>
                      <span className="text-stone-500">{source.lead_count} leads</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{ width: `${Math.min(100, Math.max(12, source.lead_count * 18))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm">
            <SectionTitle
              icon={Clock3}
              iconTone="bg-amber-50 text-amber-700"
              title="Recent Activity"
              text="A compact feed of the latest execution, useful for spotting whether activity is happening where it should."
            />
            <div className="mt-5 space-y-3">
              {recentActivities.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-200 p-6 text-sm text-stone-500">No recent activities yet.</div>
              ) : recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 rounded-2xl border border-stone-200 p-4">
                  <div className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-stone-600">
                    {activity.type}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-stone-900">{activity.subject}</div>
                    <div className="mt-1 text-xs text-stone-500">
                      {activity.deal_title || 'General activity'} • {activity.user_name || 'System'} • {formatDate(activity.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
