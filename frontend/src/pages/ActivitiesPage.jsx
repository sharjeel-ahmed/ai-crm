import { useState, useEffect } from 'react';
import api from '../api/client';
import Modal from '../components/common/Modal';
import { Plus, Phone, Mail, Calendar, FileText, CheckSquare, Check } from 'lucide-react';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import toast from 'react-hot-toast';
import usePageTitle from '../hooks/usePageTitle';

const typeIcons = { call: Phone, email: Mail, meeting: Calendar, note: FileText, task: CheckSquare };
const typeColors = { call: 'bg-blue-100 text-blue-700', email: 'bg-green-100 text-green-700', meeting: 'bg-purple-100 text-purple-700', note: 'bg-yellow-100 text-yellow-700', task: 'bg-red-100 text-red-700' };

const emptyForm = { type: 'call', subject: '', description: '', due_date: '', deal_id: '', contact_id: '' };

export default function ActivitiesPage() {
  usePageTitle('Activities');
  const [activities, setActivities] = useState([]);
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState('');

  const load = () => {
    const params = filter ? `?type=${filter}` : '';
    api.get(`/activities${params}`).then((r) => setActivities(r.data));
    api.get('/deals').then((r) => setDeals(r.data));
    api.get('/contacts').then((r) => setContacts(r.data));
  };
  useEffect(() => { load(); }, [filter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/activities', { ...form, deal_id: form.deal_id || null, contact_id: form.contact_id || null, due_date: form.due_date || null });
      toast.success('Activity created');
      setModalOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const toggleComplete = async (activity) => {
    try {
      await api.put(`/activities/${activity.id}`, { is_completed: activity.is_completed ? 0 : 1 });
      load();
    } catch {
      toast.error('Error updating activity');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Activities</h2>
        <div className="flex gap-3">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Types</option>
            {['call', 'email', 'meeting', 'note', 'task'].map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <button onClick={() => { setForm(emptyForm); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus size={20} /> Log Activity
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {activities.length === 0 && <p className="text-center text-gray-500 py-8">No activities found</p>}
        {activities.map((a) => {
          const Icon = typeIcons[a.type] || FileText;
          return (
            <div key={a.id} className={`bg-white rounded-lg shadow-sm border p-4 flex items-start gap-4 ${a.is_completed ? 'opacity-60' : ''}`}>
              <div className={`p-2 rounded-lg ${typeColors[a.type]}`}><Icon size={20} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-medium text-gray-900 ${a.is_completed ? 'line-through' : ''}`}>{a.subject}</h4>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{a.type}</span>
                  </div>
                  <span className="text-sm text-gray-500 whitespace-nowrap shrink-0">{formatDateTime(a.created_at)}</span>
                </div>
                {a.description && <p className="text-sm text-gray-600 mt-1">{a.description}</p>}
                <div className="flex gap-4 mt-2 text-xs text-gray-400">
                  {a.user_name && <span>{a.user_name}</span>}
                  {a.deal_title && <span>Deal: {a.deal_title}</span>}
                  {a.contact_name && <span>Contact: {a.contact_name}</span>}
                  {a.due_date && <span>Due: {formatDate(a.due_date)}</span>}
                </div>
              </div>
              <button onClick={() => toggleComplete(a)} className={`p-1 rounded ${a.is_completed ? 'text-green-600' : 'text-gray-300 hover:text-green-500'}`}>
                <Check size={20} />
              </button>
            </div>
          );
        })}
      </div>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Log Activity">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              {['call', 'email', 'meeting', 'note', 'task'].map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date & Time</label>
            <input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deal</label>
              <select value={form.deal_id} onChange={(e) => setForm({ ...form, deal_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">None</option>
                {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
              <select value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">None</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
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
