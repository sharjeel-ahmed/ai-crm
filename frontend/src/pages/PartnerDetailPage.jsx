import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { ArrowLeft, Handshake, Users, Briefcase, Mail, Phone, IndianRupee, User } from 'lucide-react';
import { formatDate } from '../utils/dateFormat';
import usePageTitle from '../hooks/usePageTitle';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const typeColors = {
  'Channel Partner': 'bg-blue-100 text-blue-700',
  'Outbound Partner': 'bg-purple-100 text-purple-700',
  'Referral Partner': 'bg-green-100 text-green-700',
};

const stageColors = {
  Lead: 'bg-gray-100 text-gray-700',
  Qualified: 'bg-blue-100 text-blue-700',
  Proposal: 'bg-purple-100 text-purple-700',
  Negotiation: 'bg-yellow-100 text-yellow-700',
  Won: 'bg-green-100 text-green-700',
  Lost: 'bg-red-100 text-red-700',
};

export default function PartnerDetailPage() {
  usePageTitle('Partner Details');
  const { id } = useParams();
  const navigate = useNavigate();
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/partners/${id}`)
      .then(r => setPartner(r.data))
      .catch(() => navigate('/partners'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (!partner) return null;

  const totalDealValue = partner.deals.reduce((sum, d) => sum + (d.value || 0), 0);
  const wonDeals = partner.deals.filter(d => d.stage_name === 'Won');
  const wonValue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const activeDeals = partner.deals.filter(d => d.stage_name !== 'Won' && d.stage_name !== 'Lost');

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/partners')} className="p-1 hover:bg-gray-100 rounded">
          <ArrowLeft size={20} className="text-gray-500" />
        </button>
        <Handshake size={24} className="text-indigo-600" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{partner.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[partner.type] || 'bg-gray-100 text-gray-700'}`}>
              {partner.type}
            </span>
            {partner.created_by_name && <span className="text-sm text-gray-500">Added by {partner.created_by_name}</span>}
          </div>
        </div>
      </div>

      {/* Partner Info + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow border p-4">
          <div className="text-sm text-gray-500 mb-1">Primary Contact</div>
          <div className="font-medium text-gray-900">{partner.contact_name || '—'}</div>
          {partner.email && (
            <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
              <Mail size={12} /> {partner.email}
            </div>
          )}
          {partner.phone && (
            <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
              <Phone size={12} /> {partner.phone}
            </div>
          )}
        </div>
        <div className="bg-white rounded-lg shadow border p-4">
          <div className="text-sm text-gray-500 mb-1">Linked Contacts</div>
          <div className="text-2xl font-bold text-gray-900">{partner.contacts.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow border p-4">
          <div className="text-sm text-gray-500 mb-1">Total Deals</div>
          <div className="text-2xl font-bold text-gray-900">{partner.deals.length}</div>
          <div className="text-sm text-gray-400">{fmt(totalDealValue)}</div>
        </div>
        <div className="bg-white rounded-lg shadow border p-4">
          <div className="text-sm text-green-600 mb-1">Won</div>
          <div className="text-2xl font-bold text-green-700">{wonDeals.length}</div>
          <div className="text-sm text-gray-400">{fmt(wonValue)}</div>
        </div>
      </div>

      {/* Notes */}
      {partner.notes && (
        <div className="bg-white rounded-lg shadow border p-4 mb-6">
          <div className="text-sm font-medium text-gray-700 mb-1">Notes</div>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{partner.notes}</p>
        </div>
      )}

      {/* Contacts Section */}
      <div className="mb-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
          <Users size={18} /> Contacts ({partner.contacts.length})
        </h3>
        {partner.contacts.length === 0 ? (
          <div className="bg-white rounded-lg shadow border p-6 text-center text-gray-500 text-sm">
            No contacts linked to this partner yet
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {partner.contacts.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-gray-400" />
                        {c.first_name} {c.last_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{c.job_title || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {c.company_id ? (
                        <button onClick={() => navigate(`/companies/${c.company_id}`)} className="text-blue-600 hover:underline">
                          {c.company_name}
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deals Section */}
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
          <Briefcase size={18} /> Deals ({partner.deals.length})
        </h3>
        {partner.deals.length === 0 ? (
          <div className="bg-white rounded-lg shadow border p-6 text-center text-gray-500 text-sm">
            No deals associated with this partner yet
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {partner.deals.map(d => (
                  <tr
                    key={d.id}
                    onClick={() => navigate(`/deals/${d.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{d.company_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{fmt(d.value)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stageColors[d.stage_name] || 'bg-gray-100 text-gray-700'}`}>
                        {d.stage_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{d.owner_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">{formatDate(d.created_at)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-700" colSpan={2}>Total</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{fmt(totalDealValue)}</td>
                  <td colSpan={3} className="px-4 py-3 text-sm text-gray-500">
                    {activeDeals.length} active, {wonDeals.length} won, {partner.deals.filter(d => d.stage_name === 'Lost').length} lost
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
