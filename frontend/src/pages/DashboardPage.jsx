import { useState, useEffect } from 'react';
import api from '../api/client';
import { IndianRupee, TrendingUp, CheckCircle, BarChart3, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

function MetricCard({ title, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [pipelineData, setPipelineData] = useState([]);
  const [agingData, setAgingData] = useState([]);

  useEffect(() => {
    api.get('/reports/dashboard').then((r) => setData(r.data));
    api.get('/reports/pipeline-value').then((r) => setPipelineData(r.data));
    api.get('/reports/deal-aging').then((r) => setAgingData(r.data));
  }, []);

  if (!data) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard title="Total Deals" value={data.totalDeals} icon={BarChart3} color="bg-blue-500" />
        <MetricCard title="Pipeline Value" value={fmt(data.totalValue)} icon={IndianRupee} color="bg-green-500" />
        <MetricCard title="Won Deals" value={data.wonDeals} icon={CheckCircle} color="bg-emerald-500" />
        <MetricCard title="Won Value" value={fmt(data.wonValue)} icon={TrendingUp} color="bg-purple-500" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Pipeline by Stage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pipelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" />
              <YAxis />
              <Tooltip formatter={(v) => fmt(v)} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Deals by Stage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pipelineData.filter(d => d.count > 0)} dataKey="count" nameKey="stage" cx="50%" cy="50%" outerRadius={100} label={(e) => e.stage}>
                {pipelineData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      {agingData.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={20} className="text-amber-500" />
            <h3 className="text-lg font-semibold">Deal Aging by Stage</h3>
            <span className="text-xs text-gray-400 ml-2">Days deals have spent in current stage (active deals only)</span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={agingData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" label={{ value: 'Days', position: 'insideBottomRight', offset: -5 }} />
              <YAxis type="category" dataKey="stage" width={100} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
                    <p className="font-semibold text-gray-900 mb-1">{d.stage}</p>
                    <p className="text-amber-600">Avg: {d.avg_days} days</p>
                    <p className="text-red-500">Max: {d.max_days} days</p>
                    <p className="text-gray-500">{d.deal_count} deal{d.deal_count !== 1 ? 's' : ''}</p>
                  </div>
                );
              }} />
              <Legend />
              <Bar dataKey="avg_days" name="Avg Days" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              <Bar dataKey="max_days" name="Max Days" fill="#ef4444" radius={[0, 4, 4, 0]} opacity={0.5} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Longest Aging Deals</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {agingData.flatMap(s => s.deals).sort((a, b) => b.days_in_stage - a.days_in_stage).slice(0, 6).map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                  <span className="font-medium text-gray-800 truncate mr-2">{d.title}</span>
                  <span className={`shrink-0 font-semibold ${d.days_in_stage > 30 ? 'text-red-600' : d.days_in_stage > 14 ? 'text-amber-600' : 'text-green-600'}`}>
                    {d.days_in_stage}d
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {data.recentActivities.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Activities</h3>
          <div className="space-y-3">
            {data.recentActivities.map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-sm">
                <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-medium uppercase">{a.type}</span>
                <span className="font-medium">{a.subject}</span>
                <span className="text-gray-400 ml-auto">{a.user_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
