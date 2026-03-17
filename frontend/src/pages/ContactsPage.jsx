import { useState, useEffect } from 'react';
import api from '../api/client';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import { Plus, Pencil, Trash2, EyeOff, Handshake } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const emptyForm = { first_name: '', last_name: '', email: '', phone: '', job_title: '', company_id: '' };

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertContact, setConvertContact] = useState(null);
  const [partnerType, setPartnerType] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [convertMode, setConvertMode] = useState('existing'); // 'existing' or 'new'
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [partners, setPartners] = useState([]);
  const partnerTypes = ['Channel Partner', 'Outbound Partner', 'Referral Partner'];

  const load = () => {
    api.get('/contacts').then((r) => setContacts(r.data));
    api.get('/companies').then((r) => setCompanies(r.data));
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, company_id: form.company_id || null };
    try {
      if (editing) {
        await api.put(`/contacts/${editing}`, payload);
        toast.success('Contact updated');
      } else {
        await api.post('/contacts', payload);
        toast.success('Contact created');
      }
      setModalOpen(false);
      setForm(emptyForm);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const handleEdit = (contact) => {
    setForm({
      first_name: contact.first_name, last_name: contact.last_name,
      email: contact.email || '', phone: contact.phone || '',
      job_title: contact.job_title || '', company_id: contact.company_id || '',
    });
    setEditing(contact.id);
    setModalOpen(true);
  };

  const handleIgnore = async (contact) => {
    if (!contact.email) return toast.error('Contact has no email address');
    if (!confirm(`Add ${contact.email} to the ignore list? Emails from/to this address will skip AI processing.`)) return;
    try {
      await api.post('/ignore-list', { email_address: contact.email, reason: `Contact: ${contact.first_name} ${contact.last_name}` });
      toast.success(`${contact.email} added to ignore list`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this contact?')) return;
    try {
      await api.delete(`/contacts/${id}`);
      toast.success('Contact deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const handleConvertToPartner = async (e) => {
    e.preventDefault();
    if (!convertContact) return;
    try {
      let partnerId;
      if (convertMode === 'existing') {
        if (!selectedPartnerId) return;
        partnerId = selectedPartnerId;
      } else {
        if (!partnerType || !partnerName) return;
        const res = await api.post('/partners', {
          name: partnerName,
          type: partnerType,
          contact_name: `${convertContact.first_name} ${convertContact.last_name}`,
          email: convertContact.email || '',
          phone: convertContact.phone || '',
        });
        partnerId = res.data.id;
      }
      // Link contact to partner
      await api.put(`/contacts/${convertContact.id}`, { partner_id: partnerId });
      toast.success(convertMode === 'existing' ? 'Contact linked to partner' : 'Contact converted to partner');
      setConvertModalOpen(false);
      setConvertContact(null);
      setPartnerType('');
      setSelectedPartnerId('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const columns = [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'company_name', label: 'Company', render: (row) => row.company_id ? (
      <button onClick={(e) => { e.stopPropagation(); navigate(`/companies/${row.company_id}`); }} className="text-blue-600 hover:text-blue-800 hover:underline">
        {row.company_name}
      </button>
    ) : null },
    { key: 'owner_name', label: 'Owner' },
    {
      key: 'actions', label: 'Actions', sortable: false,
      render: (row) => (
        <div className="flex gap-2">
          <button onClick={(e) => { e.stopPropagation(); handleEdit(row); }} className="text-blue-600 hover:text-blue-800" title="Edit"><Pencil size={16} /></button>
          {row.partner_id ? (
            <span className="text-gray-300 cursor-default" title="Partner"><Handshake size={16} /></span>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); setConvertContact(row); setPartnerType(''); setPartnerName(row.company_name || `${row.first_name} ${row.last_name}`); setSelectedPartnerId(''); setConvertMode('existing'); api.get('/partners').then(r => setPartners(r.data)); setConvertModalOpen(true); }} className="text-indigo-600 hover:text-indigo-800" title="Convert to Partner"><Handshake size={16} /></button>
          )}
          {row.email && (
            <button onClick={(e) => { e.stopPropagation(); handleIgnore(row); }} className="text-gray-500 hover:text-gray-700" title="Add to ignore list"><EyeOff size={16} /></button>
          )}
          {['admin', 'manager'].includes(user?.role) && (
            <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }} className="text-red-600 hover:text-red-800" title="Delete"><Trash2 size={16} /></button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Contacts</h2>
        <button onClick={() => { setForm(emptyForm); setEditing(null); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={20} /> Add Contact
        </button>
      </div>
      <DataTable columns={columns} data={contacts} />
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Contact' : 'New Contact'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
            <input type="text" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <select value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">No Company</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
          </div>
        </form>
      </Modal>
      <Modal isOpen={convertModalOpen} onClose={() => setConvertModalOpen(false)} title="Link to Partner">
        {convertContact && (
          <form onSubmit={handleConvertToPartner} className="space-y-4">
            <p className="text-sm text-gray-600">
              Link <span className="font-medium text-gray-900">{convertContact.first_name} {convertContact.last_name}</span>
              {convertContact.company_name ? ` (${convertContact.company_name})` : ''} to a partner.
            </p>

            {/* Mode toggle */}
            <div className="flex gap-1">
              <button type="button" onClick={() => setConvertMode('existing')}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg ${convertMode === 'existing' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Existing Partner
              </button>
              <button type="button" onClick={() => setConvertMode('new')}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg ${convertMode === 'new' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                New Partner
              </button>
            </div>

            {convertMode === 'existing' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Partner</label>
                <select value={selectedPartnerId} onChange={(e) => setSelectedPartnerId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                  <option value="">Choose a partner...</option>
                  {partners.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Partner Name</label>
                  <input type="text" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Partner Type</label>
                  <select value={partnerType} onChange={(e) => setPartnerType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                    <option value="">Select Type</option>
                    {partnerTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => setConvertModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                {convertMode === 'existing' ? 'Link' : 'Create & Link'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
