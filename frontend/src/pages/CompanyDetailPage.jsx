import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import Modal from '../components/common/Modal';
import { Building2, ArrowLeft, Users, Briefcase, Globe, Phone, MapPin, Factory, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

const stageColors = {
  Lead: 'bg-gray-100 text-gray-700',
  Qualified: 'bg-blue-100 text-blue-700',
  Proposal: 'bg-purple-100 text-purple-700',
  Negotiation: 'bg-yellow-100 text-yellow-700',
  Won: 'bg-green-100 text-green-700',
  Lost: 'bg-red-100 text-red-700',
};

export default function CompanyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', industry: '', website: '', phone: '', address: '' });

  const loadCompany = () => {
    return api.get(`/companies/${id}`)
      .then(r => setCompany(r.data))
      .catch(() => navigate('/companies'));
  };

  useEffect(() => {
    setLoading(true);
    loadCompany().finally(() => setLoading(false));
  }, [id]);

  const openEditModal = () => {
    setForm({
      name: company.name || '',
      industry: company.industry || '',
      website: company.website || '',
      phone: company.phone || '',
      address: company.address || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/companies/${id}`, form);
      toast.success('Company updated');
      setModalOpen(false);
      loadCompany();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (!company) return null;

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate('/companies')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft size={16} /> Back to Companies
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 rounded-lg">
            <Building2 size={24} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{company.name}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-0.5">
              {company.industry && <span className="flex items-center gap-1"><Factory size={14} /> {company.industry}</span>}
              {company.website && <span className="flex items-center gap-1"><Globe size={14} /> {company.website}</span>}
              {company.phone && <span className="flex items-center gap-1"><Phone size={14} /> {company.phone}</span>}
              {company.address && <span className="flex items-center gap-1"><MapPin size={14} /> {company.address}</span>}
            </div>
          </div>
          <button onClick={openEditModal} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Pencil size={16} /> Edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contacts */}
        <div className="bg-white rounded-lg shadow border">
          <div className="flex items-center gap-2 p-4 border-b">
            <Users size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-900">Contacts</h3>
            <span className="text-xs text-gray-400 ml-1">({company.contacts?.length || 0})</span>
          </div>
          {company.contacts?.length > 0 ? (
            <div className="divide-y">
              {company.contacts.map(c => (
                <div key={c.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{c.first_name} {c.last_name}</div>
                      {c.job_title && <div className="text-xs text-gray-500">{c.job_title}</div>}
                    </div>
                    <div className="text-right text-sm">
                      {c.email && <div className="text-gray-600">{c.email}</div>}
                      {c.phone && <div className="text-gray-400 text-xs">{c.phone}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400 text-sm">No contacts linked to this company</div>
          )}
        </div>

        {/* Deals */}
        <div className="bg-white rounded-lg shadow border">
          <div className="flex items-center gap-2 p-4 border-b">
            <Briefcase size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-900">Deals</h3>
            <span className="text-xs text-gray-400 ml-1">({company.deals?.length || 0})</span>
          </div>
          {company.deals?.length > 0 ? (
            <div className="divide-y">
              {company.deals.map(d => (
                <div key={d.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{d.title}</div>
                      {d.contact_name && d.contact_name.trim() && (
                        <div className="text-xs text-gray-500">{d.contact_name}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stageColors[d.stage_name] || 'bg-gray-100 text-gray-700'}`}>
                        {d.stage_name}
                      </span>
                      {d.value > 0 && <span className="text-sm font-semibold text-gray-700">{fmt(d.value)}</span>}
                    </div>
                  </div>
                  {d.notes && <div className="text-xs text-gray-400 mt-1 truncate">{d.notes}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400 text-sm">No deals linked to this company</div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Edit Company">
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { key: 'name', label: 'Company Name', required: true },
            { key: 'industry', label: 'Industry' },
            { key: 'website', label: 'Website' },
            { key: 'phone', label: 'Phone' },
            { key: 'address', label: 'Address' },
          ].map(({ key, label, required }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type="text"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={required}
              />
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
