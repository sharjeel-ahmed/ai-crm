import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const partnerTypes = ['Channel Partner', 'Outbound Partner', 'Referral Partner'];
const typeColors = {
  'Channel Partner': 'bg-blue-100 text-blue-700',
  'Outbound Partner': 'bg-purple-100 text-purple-700',
  'Referral Partner': 'bg-green-100 text-green-700',
};

const emptyForm = { name: '', type: '', contact_name: '', email: '', phone: '', notes: '' };

export default function PartnersPage() {
  const [partners, setPartners] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const load = () => api.get('/partners').then((r) => setPartners(r.data));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/partners/${editing}`, form);
        toast.success('Partner updated');
      } else {
        await api.post('/partners', form);
        toast.success('Partner created');
      }
      setModalOpen(false);
      setForm(emptyForm);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const handleEdit = (partner) => {
    setForm({
      name: partner.name || '',
      type: partner.type || '',
      contact_name: partner.contact_name || '',
      email: partner.email || '',
      phone: partner.phone || '',
      notes: partner.notes || '',
    });
    setEditing(partner.id);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this partner?')) return;
    try {
      await api.delete(`/partners/${id}`);
      toast.success('Partner deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const columns = [
    { key: 'name', label: 'Partner Name', render: (row) => (
      <button onClick={(e) => { e.stopPropagation(); navigate(`/partners/${row.id}`); }} className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
        {row.name}
      </button>
    )},
    { key: 'type', label: 'Type', render: (row) => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[row.type] || 'bg-gray-100 text-gray-700'}`}>
        {row.type}
      </span>
    )},
    { key: 'contact_name', label: 'Contact Person' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    {
      key: 'actions', label: 'Actions', sortable: false,
      render: (row) => (
        <div className="flex gap-2">
          <button onClick={(e) => { e.stopPropagation(); handleEdit(row); }} className="text-blue-600 hover:text-blue-800"><Pencil size={16} /></button>
          {['admin', 'manager'].includes(user?.role) && (
            <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Partners</h2>
        <button onClick={() => { setForm(emptyForm); setEditing(null); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={20} /> Add Partner
        </button>
      </div>
      <DataTable columns={columns} data={partners} />
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Partner' : 'New Partner'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Partner Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Partner Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
              <option value="">Select Type</option>
              {partnerTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
            <input type="text" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
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
