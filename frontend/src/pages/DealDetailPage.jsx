import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import Modal from '../components/common/Modal';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import { ArrowLeft, Briefcase, Building2, Users, CalendarCheck, IndianRupee, Phone, Mail as MailIcon, MailOpen, Sparkles, ChevronDown, Pencil, Clock, Archive, RotateCcw, Merge, Search, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import DealSentimentBadge from '../components/deals/DealSentimentBadge';
import { useAuth } from '../context/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import { formatStageAge, stageAgeColor } from '../utils/stageAge';

const stageColors = {
  Lead: 'bg-gray-100 text-gray-700',
  Qualified: 'bg-blue-100 text-blue-700',
  Proposal: 'bg-purple-100 text-purple-700',
  Negotiation: 'bg-yellow-100 text-yellow-700',
  Won: 'bg-green-100 text-green-700',
  Lost: 'bg-red-100 text-red-700',
};

const activityTypeConfig = {
  call: { icon: Phone, color: 'bg-orange-100 text-orange-600' },
  email: { icon: MailIcon, color: 'bg-blue-100 text-blue-600' },
  meeting: { icon: Users, color: 'bg-purple-100 text-purple-600' },
  note: { icon: CalendarCheck, color: 'bg-gray-100 text-gray-600' },
  task: { icon: CalendarCheck, color: 'bg-yellow-100 text-yellow-600' },
};

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
const leadSources = ['Inbound', 'Outbound', 'Channel Partner', 'Referral', 'Website', 'Event', 'Other'];
const priorities = ['low', 'medium', 'high'];
const priorityColors = { high: 'bg-red-100 text-red-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-gray-100 text-gray-600' };

export default function DealDetailPage() {
  usePageTitle('Deal Details');
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [stages, setStages] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [partners, setPartners] = useState([]);
  const [owners, setOwners] = useState([]);
  const [form, setForm] = useState({ title: '', value: '', stage_id: '', company_id: '', contact_id: '', owner_id: '', expected_close: '', notes: '', lead_source: '', partner_id: '', priority: 'medium' });
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeDeals, setMergeDeals] = useState([]);
  const [selectedMergeDeal, setSelectedMergeDeal] = useState(null);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'call', subject: '', description: '', due_date: '' });
  const activityContacts = deal?.contacts || [];

  const loadDeal = (allActivities = false) => {
    return api.get(`/deals/${id}${allActivities ? '?all_activities=1' : ''}`)
      .then(r => setDeal(r.data))
      .catch(() => navigate('/deals'));
  };

  useEffect(() => {
    setLoading(true);
    loadDeal().finally(() => setLoading(false));
  }, [id]);

  const openEditModal = () => {
    Promise.all([
      api.get('/stages'),
      api.get('/companies'),
      api.get('/contacts'),
      api.get('/partners'),
      api.get('/deals/owners'),
    ]).then(([stagesRes, companiesRes, contactsRes, partnersRes, ownersRes]) => {
      setStages(stagesRes.data);
      setCompanies(companiesRes.data);
      setContacts(contactsRes.data);
      setPartners(partnersRes.data);
      setOwners(ownersRes.data);
      setForm({
        title: deal.title || '',
        value: deal.value || '',
        stage_id: deal.stage_id || '',
        company_id: deal.company_id || '',
        contact_id: deal.contact_id || '',
        owner_id: deal.owner_id || '',
        expected_close: deal.expected_close?.split('T')[0] || '',
        notes: deal.notes || '',
        lead_source: deal.lead_source || '',
        partner_id: deal.partner_id || '',
        priority: deal.priority || 'medium',
      });
      setModalOpen(true);
    });
  };

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
      await api.put(`/deals/${id}`, payload);
      toast.success('Deal updated');
      setModalOpen(false);
      loadDeal(showAll);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (!deal) return null;

  const dealStageAge = formatStageAge(deal.days_in_stage);

  const activities = deal.activities || [];
  const totalActivities = deal.total_activities || activities.length;
  const displayedActivities = showAll ? activities : activities;
  const hasMore = totalActivities > activities.length && !showAll;

  const handleViewAll = () => {
    loadDeal(true).then(() => setShowAll(true));
  };

  const openMergeModal = () => {
    api.get('/deals?include_closed=1').then((r) => {
      setMergeDeals(r.data.filter((d) => d.id !== parseInt(id)));
      setMergeSearch('');
      setSelectedMergeDeal(null);
      setMergeModalOpen(true);
    });
  };

  const handleMerge = async () => {
    if (!selectedMergeDeal) return;
    if (!confirm(`Merge "${selectedMergeDeal.title}" into "${deal.title}"? This will move all activities and delete "${selectedMergeDeal.title}".`)) return;
    try {
      await api.post(`/deals/${id}/merge`, { source_deal_id: selectedMergeDeal.id });
      toast.success(`Merged "${selectedMergeDeal.title}" into this deal`);
      setMergeModalOpen(false);
      loadDeal(showAll);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const handleToggleLifecycle = async () => {
    const newState = deal.lifecycle_state === 'closed' ? 'active' : 'closed';
    const action = newState === 'closed' ? 'close' : 'reopen';
    if (!confirm(`Are you sure you want to ${action} this deal?`)) return;
    try {
      await api.patch(`/deals/${id}/lifecycle`, { lifecycle_state: newState });
      toast.success(`Deal ${newState === 'closed' ? 'closed' : 'reopened'}`);
      loadDeal(showAll);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const handleActivitySubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/activities', {
        ...activityForm,
        deal_id: parseInt(id),
        contact_id: activityForm.contact_id || null,
        due_date: activityForm.due_date || null,
      });
      toast.success('Activity created');
      setActivityModalOpen(false);
      setActivityForm({ type: 'call', subject: '', description: '', due_date: '', contact_id: '' });
      loadDeal(showAll);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-green-100 rounded-lg">
            <Briefcase size={24} className="text-green-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">{deal.title}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${stageColors[deal.stage_name] || 'bg-gray-100 text-gray-700'}`}>
                {deal.stage_name}
              </span>
              {dealStageAge && (
                <span className={`flex items-center gap-1 text-xs ${stageAgeColor(deal.days_in_stage)}`} title="Time in current stage">
                  <Clock size={13} />{dealStageAge} in stage
                </span>
              )}
              <DealSentimentBadge sentiment={deal.sentiment} />
              {deal.priority && (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${priorityColors[deal.priority] || priorityColors.medium}`}>
                  {deal.priority} priority
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-0.5">
              {deal.value > 0 && <span className="flex items-center gap-1 font-semibold text-green-600"><IndianRupee size={14} /> {fmt(deal.value)}</span>}
              {deal.company_name && (
                <button onClick={() => navigate(`/companies/${deal.company_id}`)} className="flex items-center gap-1 text-blue-600 hover:underline">
                  <Building2 size={14} /> {deal.company_name}
                </button>
              )}
              {deal.lead_source && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{deal.lead_source}</span>}
              {deal.partner_name && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">via {deal.partner_name}</span>}
              {deal.owner_name && <span>Owner: {deal.owner_name}</span>}
              {deal.expected_close && <span>Close: {formatDate(deal.expected_close)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {deal.lifecycle_state === 'closed' && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600">Closed</span>
            )}
            {(user?.role === 'admin' || user?.role === 'manager') && (
              <>
                <button
                  onClick={openMergeModal}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50"
                >
                  <Merge size={16} /> Merge
                </button>
                <button
                  onClick={handleToggleLifecycle}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${deal.lifecycle_state === 'closed' ? 'border border-green-300 text-green-700 hover:bg-green-50' : 'border border-stone-300 text-stone-700 hover:bg-stone-50'}`}
                >
                  {deal.lifecycle_state === 'closed' ? <><RotateCcw size={16} /> Reopen</> : <><Archive size={16} /> Close Deal</>}
                </button>
              </>
            )}
            <button onClick={openEditModal} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Pencil size={16} /> Edit
            </button>
          </div>
        </div>
        {deal.notes && (
          <div className="mt-3 ml-14 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{deal.notes}</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contacts - narrower column */}
        <div className="bg-white rounded-lg shadow border">
          <div className="flex items-center gap-2 p-4 border-b">
            <Users size={18} className="text-gray-500" />
            <h3 className="font-semibold text-gray-900">Contacts</h3>
            <span className="text-xs text-gray-400 ml-1">({deal.contacts?.length || 0})</span>
          </div>
          {deal.contacts?.length > 0 ? (
            <div className="divide-y">
              {deal.contacts.map(c => (
                <div key={c.id} className="p-4 hover:bg-gray-50">
                  <div className="font-medium text-gray-900 text-sm">{c.first_name} {c.last_name}</div>
                  {c.job_title && <div className="text-xs text-gray-500">{c.job_title}</div>}
                  {c.email && <div className="text-xs text-gray-500 mt-1">{c.email}</div>}
                  {c.phone && <div className="text-xs text-gray-400">{c.phone}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400 text-sm">No contacts</div>
          )}
        </div>

        {/* Activity Timeline - wider column */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow border">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <CalendarCheck size={18} className="text-gray-500" />
              <h3 className="font-semibold text-gray-900">Activity Timeline</h3>
              <span className="text-xs text-gray-400 ml-1">({totalActivities})</span>
            </div>
            <button
              onClick={() => { setActivityForm({ type: 'call', subject: '', description: '', due_date: '', contact_id: '' }); setActivityModalOpen(true); }}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={14} /> Log Activity
            </button>
          </div>
          {displayedActivities.length > 0 ? (
            <div>
              <div className="divide-y">
                {displayedActivities.map((a, idx) => {
                  const isEmail = a.source === 'email';
                  const config = activityTypeConfig[a.type] || activityTypeConfig.note;
                  const Icon = isEmail
                    ? (a.is_inbound ? MailIcon : MailOpen)
                    : config.icon;
                  const iconColor = isEmail
                    ? (a.is_inbound ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600')
                    : config.color;

                  return (
                    <div key={a.id || idx} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded ${iconColor} mt-0.5 shrink-0`}>
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium text-sm text-gray-700 truncate">{a.subject}</span>
                              {a.ai_generated ? (
                                <Sparkles size={12} className="text-blue-400 shrink-0" title="AI generated" />
                              ) : null}
                              {isEmail && (
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${a.is_inbound ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                  {a.is_inbound ? 'Inbound' : 'Outbound'}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                              {formatDateTime(a.created_at)}
                            </span>
                          </div>
                          {a.description && <div className="text-xs text-black mt-1">{a.description}</div>}
                          <div className="flex gap-3 mt-1 text-xs text-gray-400">
                            {!isEmail && <span className="capitalize">{a.type}</span>}
                            {a.user_name && !isEmail && <span>by {a.user_name}</span>}
                            {a.contact_name && a.contact_name.trim() && <span>Contact: {a.contact_name}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {hasMore && (
                <div className="p-3 border-t">
                  <button
                    onClick={handleViewAll}
                    className="w-full flex items-center justify-center gap-1 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <ChevronDown size={16} />
                    View all {totalActivities} activities
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400 text-sm">No activities recorded for this deal</div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Edit Deal" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
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
              <select value={form.contact_id} onChange={(e) => setForm({ ...form, contact_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">None</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                {priorities.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
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

      {/* Activity Modal */}
      <Modal isOpen={activityModalOpen} onClose={() => setActivityModalOpen(false)} title="Log Activity">
        <form onSubmit={handleActivitySubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={activityForm.type} onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              {['call', 'email', 'meeting', 'note', 'task'].map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input type="text" value={activityForm.subject} onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={activityForm.description} onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date & Time</label>
              <input type="datetime-local" value={activityForm.due_date} onChange={(e) => setActivityForm({ ...activityForm, due_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
              <select value={activityForm.contact_id || ''} onChange={(e) => setActivityForm({ ...activityForm, contact_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">None</option>
                {activityContacts.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setActivityModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
          </div>
        </form>
      </Modal>

      {/* Merge Modal */}
      <Modal isOpen={mergeModalOpen} onClose={() => setMergeModalOpen(false)} title="Merge Deal Into This One" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select a deal to merge <strong>into "{deal?.title}"</strong>. All activities will be moved to this deal and the selected deal will be deleted.
          </p>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search deals..."
              value={mergeSearch}
              onChange={(e) => setMergeSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg divide-y">
            {mergeDeals
              .filter((d) => {
                const q = mergeSearch.toLowerCase();
                return !q || d.title.toLowerCase().includes(q) || (d.company_name || '').toLowerCase().includes(q);
              })
              .map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedMergeDeal(d)}
                  className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors ${selectedMergeDeal?.id === d.id ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-gray-900">{d.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {d.company_name || 'No company'} &middot; {d.stage_name} &middot; {fmt(d.value)}
                        {d.owner_name && <> &middot; {d.owner_name}</>}
                      </div>
                    </div>
                    {selectedMergeDeal?.id === d.id && (
                      <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Selected</span>
                    )}
                  </div>
                </button>
              ))}
            {mergeDeals.filter((d) => {
              const q = mergeSearch.toLowerCase();
              return !q || d.title.toLowerCase().includes(q) || (d.company_name || '').toLowerCase().includes(q);
            }).length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">No deals found</div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setMergeModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button
              type="button"
              onClick={handleMerge}
              disabled={!selectedMergeDeal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Merge Deal
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
