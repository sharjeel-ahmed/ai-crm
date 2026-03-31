import { useState, useEffect } from 'react';
import api from '../api/client';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';

const emptyForm = { name: '', industry: '', website: '', phone: '', address: '', country: '', is_fortune_500: false };

export default function CompaniesPage() {
  usePageTitle('Companies');
  const [companies, setCompanies] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const load = () => api.get('/companies').then((r) => setCompanies(r.data));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/companies/${editing}`, form);
        toast.success('Company updated');
      } else {
        await api.post('/companies', form);
        toast.success('Company created');
      }
      setModalOpen(false);
      setForm(emptyForm);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const handleEdit = (company) => {
    setForm({ name: company.name, industry: company.industry || '', website: company.website || '', phone: company.phone || '', address: company.address || '', country: company.country || '', is_fortune_500: !!company.is_fortune_500 });
    setEditing(company.id);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this company?')) return;
    try {
      await api.delete(`/companies/${id}`);
      toast.success('Company deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (row) => (
      <button onClick={(e) => { e.stopPropagation(); navigate(`/companies/${row.id}`); }} className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
        {row.name}
      </button>
    )},
    { key: 'industry', label: 'Industry' },
    { key: 'country', label: 'Country' },
    { key: 'is_fortune_500', label: 'Fortune 500', render: (row) => row.is_fortune_500 ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">F500</span> : null },
    { key: 'phone', label: 'Phone' },
    { key: 'website', label: 'Website' },
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
        <h2 className="text-2xl font-bold text-gray-900">Companies</h2>
        <button onClick={() => { setForm(emptyForm); setEditing(null); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={20} /> Add Company
        </button>
      </div>
      <DataTable columns={columns} data={companies} />
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Company' : 'New Company'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { key: 'name', label: 'Company Name', required: true },
            { key: 'industry', label: 'Industry' },
            { key: 'website', label: 'Website' },
            { key: 'phone', label: 'Phone' },
            { key: 'address', label: 'Address' },
            { key: 'country', label: 'Country' },
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
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_fortune_500"
              checked={form.is_fortune_500}
              onChange={(e) => setForm({ ...form, is_fortune_500: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_fortune_500" className="text-sm font-medium text-gray-700">Fortune 500 Company</label>
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
