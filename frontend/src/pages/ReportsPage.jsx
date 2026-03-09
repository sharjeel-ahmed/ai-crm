import { useState, useEffect } from 'react';
import api from '../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function ReportsPage() {
  const [pipelineData, setPipelineData] = useState([]);
  const [repData, setRepData] = useState([]);

  useEffect(() => {
    api.get('/reports/pipeline-value').then((r) => setPipelineData(r.data));
    api.get('/reports/rep-performance').then((r) => setRepData(r.data));
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Reports</h2>
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Pipeline Value by Stage</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={pipelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" />
              <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend />
              <Bar dataKey="value" name="Value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="count" name="# Deals" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Rep Performance</h3>
          {repData.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No sales rep data available</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={repData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v, name) => [typeof v === 'number' && name.includes('value') ? fmt(v) : v, name]} />
                  <Legend />
                  <Bar dataKey="total_value" name="Total Pipeline" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="won_value" name="Won Value" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rep</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Deals</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pipeline Value</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Won Deals</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Won Value</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {repData.map((rep) => (
                      <tr key={rep.user_id}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{rep.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{rep.total_deals}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{fmt(rep.total_value)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{rep.won_deals}</td>
                        <td className="px-6 py-4 text-sm text-green-600 font-medium">{fmt(rep.won_value)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{rep.total_deals ? `${Math.round((rep.won_deals / rep.total_deals) * 100)}%` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
