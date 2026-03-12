import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Archive, ArrowLeft, IndianRupee } from 'lucide-react';
import { formatDate } from '../utils/dateFormat';
import DealSentimentBadge from '../components/deals/DealSentimentBadge';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function ClosedDealsPage() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, won, lost
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.get('/deals/pipeline').then(r => {
      const closed = r.data
        .filter(s => s.is_closed)
        .flatMap(s => s.deals.map(d => ({ ...d, stage_name: s.name })));
      setDeals(closed);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? deals : deals.filter(d => d.stage_name.toLowerCase() === filter);
  const totalValue = filtered.reduce((sum, d) => sum + (d.value || 0), 0);
  const wonCount = deals.filter(d => d.stage_name === 'Won').length;
  const lostCount = deals.filter(d => d.stage_name === 'Lost').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/pipeline')} className="p-1 hover:bg-gray-100 rounded">
            <ArrowLeft size={20} className="text-gray-500" />
          </button>
          <Archive size={24} className="text-gray-600" />
          <h2 className="text-2xl font-bold text-gray-900">Closed Deals</h2>
          <span className="text-sm text-gray-500">{filtered.length} deals</span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow border p-4">
          <div className="text-sm text-gray-500">Total Closed</div>
          <div className="text-2xl font-bold text-gray-900">{deals.length}</div>
          <div className="text-sm text-gray-400">{fmt(deals.reduce((s, d) => s + (d.value || 0), 0))}</div>
        </div>
        <div className="bg-white rounded-lg shadow border p-4">
          <div className="text-sm text-green-600">Won</div>
          <div className="text-2xl font-bold text-green-700">{wonCount}</div>
          <div className="text-sm text-gray-400">{fmt(deals.filter(d => d.stage_name === 'Won').reduce((s, d) => s + (d.value || 0), 0))}</div>
        </div>
        <div className="bg-white rounded-lg shadow border p-4">
          <div className="text-sm text-red-600">Lost</div>
          <div className="text-2xl font-bold text-red-700">{lostCount}</div>
          <div className="text-sm text-gray-400">{fmt(deals.filter(d => d.stage_name === 'Lost').reduce((s, d) => s + (d.value || 0), 0))}</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4">
        {[['all', 'All'], ['won', 'Won'], ['lost', 'Lost']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg ${
              filter === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Archive size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No closed deals</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sentiment</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Closed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map(deal => (
                <tr
                  key={deal.id}
                  onClick={() => navigate(`/deals/${deal.id}`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{deal.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{deal.company_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{fmt(deal.value)}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      deal.stage_name === 'Won' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {deal.stage_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{deal.owner_name || '—'}</td>
                  <td className="px-4 py-3 text-sm"><DealSentimentBadge sentiment={deal.sentiment} /></td>
                  <td className="px-4 py-3 text-sm text-gray-500">{deal.lead_source || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">{formatDate(deal.stage_changed_at || deal.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500 flex justify-between">
            <span>{filtered.length} deal(s)</span>
            <span className="font-medium">Total: {fmt(totalValue)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
