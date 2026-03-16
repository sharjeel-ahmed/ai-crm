import { useState, useEffect } from 'react';
import api from '../api/client';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import DealSentimentBadge from '../components/deals/DealSentimentBadge';
import { useAuth } from '../context/AuthContext';

const leadSources = ['Inbound', 'Outbound', 'Channel Partner', 'Referral', 'Website', 'Event', 'Other'];
const emptyForm = { title: '', value: '', stage_id: '', company_id: '', contact_id: '', owner_id: '', expected_close: '', notes: '', lead_source: '', partner_id: '' };

export default function DealsPage() {
  const { user } = useAuth();
  const [deals, setDeals] = useState([]);
  const [stages, setStages] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [partners, setPartners] = useState([]);
  const [owners, setOwners] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [dealFilter, setDealFilter] = useState(() => localStorage.getItem('dealFilter') || 'all');
  const changeDealFilter = (v) => { localStorage.setItem('dealFilter', v); setDealFilter(v); };
  const navigate = useNavigate();

  const load = () => {
    const params = dealFilter === 'all' ? '' : dealFilter === 'mine' ? '?my_deals=true' : `?owner_id=${dealFilter}`;
    api.get(`/deals${params}`).then((r) => setDeals(r.data));
    api.get('/stages').then((r) => setStages(r.data));
    api.get('/companies').then((r) => setCompanies(r.data));
    api.get('/contacts').then((r) => setContacts(r.data));
    api.get('/partners').then((r) => setPartners(r.data));
    api.get('/deals/owners').then((r) => setOwners(r.data));
  };
  useEffect(() => { load(); }, [dealFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      value: parseFloat(form.value) || 0,
      stage_id: parseInt(form.stage_id),
      company_id: form.company_id || null,
      contact_id: form.contact_id || null,
      owner_id: form.owner_id ? parseInt(form.owner_id) : null,
      partner_id: form.partner_id || null,
      expected_close: form.expected_close || null,
    };
    try {
      if (editing) {
        await api.put(`/deals/${editing}`, payload);
        toast.success('Deal updated');
      } else {
        await api.post('/deals', payload);
        toast.success('Deal created');
      }
      setModalOpen(false);
      setForm(emptyForm);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const handleEdit = (deal) => {
    setForm({
      title: deal.title, value: deal.value || '',
      stage_id: deal.stage_id || '', company_id: deal.company_id || '',
      contact_id: deal.contact_id || '', expected_close: deal.expected_close?.split('T')[0] || '',
      owner_id: deal.owner_id || '',
      notes: deal.notes || '', lead_source: deal.lead_source || '',
      partner_id: deal.partner_id || '',
    });
    setEditing(deal.id);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this deal?')) return;
    try {
      await api.delete(`/deals/${id}`);
      toast.success('Deal deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const columns = [
    { key: 'title', label: 'Title', render: (row) => (
      <button onClick={(e) => { e.stopPropagation(); navigate(`/deals/${row.id}`); }} className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer">
        {row.title}
      </button>
    )},
    { key: 'value', label: 'Value', render: (row) => fmt(row.value) },
    { key: 'stage_name', label: 'Stage' },
    { key: 'sentiment', label: 'Sentiment', render: (row) => <DealSentimentBadge sentiment={row.sentiment} /> },
    { key: 'company_name', label: 'Company', render: (row) => row.company_id ? (
      <button onClick={(e) => { e.stopPropagation(); navigate(`/companies/${row.company_id}`); }} className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">
        {row.company_name}
      </button>
    ) : null },
    { key: 'lead_source', label: 'Source', render: (row) => (
      <div className="flex flex-col gap-1">
        {row.lead_source && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{row.lead_source}</span>}
        {row.partner_name && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">via {row.partner_name}</span>}
      </div>
    )},
    { key: 'contact_name', label: 'Contact' },
    { key: 'owner_name', label: 'Owner' },
    {
      key: 'actions', label: 'Actions', sortable: false,
      render: (row) => (
        <div className="flex gap-2">
          <button onClick={(e) => { e.stopPropagation(); handleEdit(row); }} className="text-blue-600 hover:text-blue-800 cursor-pointer"><Pencil size={16} /></button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }} className="text-red-600 hover:text-red-800 cursor-pointer"><Trash2 size={16} /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900">Deals</h2>
          {user?.role !== 'sales_rep' && (
            <select
              value={dealFilter}
              onChange={(e) => changeDealFilter(e.target.value)}
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Deals</option>
              <option value="mine">My Deals</option>
              {owners.filter((o) => o.id !== user?.id).map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
        </div>
        <button onClick={() => { setForm({ ...emptyForm, stage_id: stages[0]?.id || '', owner_id: owners[0]?.id || '' }); setEditing(null); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={20} /> Add Deal
        </button>
      </div>
      <DataTable columns={columns} data={deals} />
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Deal' : 'New Deal'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Value (₹)</label>
              <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
              <select value={form.stage_id} onChange={(e) => setForm({ ...form, stage_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                <option value="">Select Stage</option>
                {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <select value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                <option value="">Select Company</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
              <select value={form.contact_id} onChange={(e) => {
                const contactId = e.target.value;
                const contact = contacts.find(c => String(c.id) === contactId);
                const updates = { contact_id: contactId };
                if (contact?.partner_id && !form.partner_id) {
                  updates.partner_id = String(contact.partner_id);
                }
                setForm({ ...form, ...updates });
              }} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">None</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.partner_name ? ` (${c.partner_name})` : ''}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lead Source</label>
              <select value={form.lead_source} onChange={(e) => setForm({ ...form, lead_source: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select Source</option>
                {leadSources.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
              <select value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                <option value="">Select Owner</option>
                {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Partner (Optional)</label>
              <select value={form.partner_id} onChange={(e) => setForm({ ...form, partner_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">None</option>
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Close</label>
            <input type="date" value={form.expected_close} onChange={(e) => setForm({ ...form, expected_close: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
