import { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { IndianRupee, ChevronLeft, ChevronRight, Clock, Pencil, Archive } from 'lucide-react';
import DealSentimentBadge from '../components/deals/DealSentimentBadge';
import { useAuth } from '../context/AuthContext';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
const leadSources = ['Inbound', 'Outbound', 'Channel Partner', 'Referral', 'Website', 'Event', 'Other'];

function stageAge(stageChangedAt) {
  if (!stageChangedAt) return null;
  const diff = Date.now() - new Date(stageChangedAt).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

function stageAgeColor(stageChangedAt) {
  if (!stageChangedAt) return 'text-gray-400';
  const days = Math.floor((Date.now() - new Date(stageChangedAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 7) return 'text-green-500';
  if (days <= 14) return 'text-yellow-500';
  return 'text-red-500';
}

function DealCard({ deal, index, onClickDeal, onEditDeal }) {
  const age = stageAge(deal.stage_changed_at);
  return (
    <Draggable draggableId={String(deal.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClickDeal(deal.id)}
          className={`bg-white rounded-lg shadow-sm border p-3 mb-2 cursor-pointer hover:border-blue-300 group ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400' : ''}`}
        >
          <div className="flex items-start justify-between gap-1">
            <h4 className="font-medium text-sm text-gray-900">{deal.title}</h4>
            <button
              onClick={(e) => { e.stopPropagation(); onEditDeal(deal); }}
              className="p-1 rounded text-gray-300 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              title="Edit deal"
            >
              <Pencil size={13} />
            </button>
          </div>
          <div className="mt-2">
            <DealSentimentBadge sentiment={deal.sentiment} />
          </div>
          {deal.company_name && <p className="text-xs text-gray-500 mt-1">{deal.company_name}</p>}
          <div className="flex items-center justify-between mt-2">
            <span className="flex items-center text-xs font-medium text-green-600">
              <IndianRupee size={12} />{fmt(deal.value).replace('₹', '')}
            </span>
            {age && (
              <span className={`flex items-center gap-1 text-xs ${stageAgeColor(deal.stage_changed_at)}`} title="Time in current stage">
                <Clock size={11} />{age}
              </span>
            )}
          </div>
          {deal.owner_name && <div className="text-xs text-gray-400 mt-1">{deal.owner_name}</div>}
        </div>
      )}
    </Draggable>
  );
}

export default function PipelinePage() {
  const { user } = useAuth();
  const [pipeline, setPipeline] = useState([]);
  const scrollRef = useRef(null);
  const topScrollRef = useRef(null);
  const topScrollInnerRef = useRef(null);
  const navigate = useNavigate();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [contentLeft, setContentLeft] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [stages, setStages] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [partners, setPartners] = useState([]);
  const [owners, setOwners] = useState([]);
  const [form, setForm] = useState({ title: '', value: '', stage_id: '', company_id: '', contact_id: '', owner_id: '', expected_close: '', notes: '', lead_source: '', partner_id: '' });
  const [myDeals, setMyDeals] = useState(() => localStorage.getItem('myDealsFilter') === 'true');
  const toggleMyDeals = (v) => { localStorage.setItem('myDealsFilter', v); setMyDeals(v); };

  const load = () => {
    const q = myDeals ? '?my_deals=true' : '';
    api.get(`/deals/pipeline${q}`).then((r) => setPipeline(r.data));
  };
  useEffect(() => { load(); }, [myDeals]);

  // Filter Won stage to only show deals from last 30 days
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const visiblePipeline = pipeline.map(stage => {
    if (stage.name === 'Won') {
      return { ...stage, deals: stage.deals.filter(d => {
        const changedAt = d.stage_changed_at || d.updated_at;
        return changedAt && new Date(changedAt).getTime() >= thirtyDaysAgo;
      })};
    }
    return stage;
  });

  const openEditModal = (deal) => {
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
      });
      setEditingDeal(deal);
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
      await api.put(`/deals/${editingDeal.id}`, payload);
      toast.success('Deal updated');
      setModalOpen(false);
      setEditingDeal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setContentLeft(el.getBoundingClientRect().left);
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    if (topScrollRef.current && topScrollRef.current.scrollLeft !== el.scrollLeft) {
      topScrollRef.current.scrollLeft = el.scrollLeft;
    }
    if (topScrollInnerRef.current) {
      topScrollInnerRef.current.style.width = `${el.scrollWidth}px`;
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [pipeline]);

  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * 300, behavior: 'smooth' });
  };

  const handleTopScroll = () => {
    const topEl = topScrollRef.current;
    const mainEl = scrollRef.current;
    if (!topEl || !mainEl) return;
    if (mainEl.scrollLeft !== topEl.scrollLeft) {
      mainEl.scrollLeft = topEl.scrollLeft;
    }
    checkScroll();
  };

  const handleMainScroll = () => {
    checkScroll();
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const dealId = parseInt(draggableId);
    const newStageId = parseInt(destination.droppableId);

    // Optimistic update
    setPipeline((prev) => {
      const updated = prev.map((stage) => ({
        ...stage,
        deals: stage.deals.filter((d) => d.id !== dealId),
      }));
      const deal = prev.flatMap((s) => s.deals).find((d) => d.id === dealId);
      const targetStage = updated.find((s) => s.id === newStageId);
      if (deal && targetStage) {
        const updatedDeal = { ...deal, stage_id: newStageId, stage_changed_at: new Date().toISOString() };
        targetStage.deals.splice(destination.index, 0, updatedDeal);
      }
      return updated;
    });

    try {
      await api.patch(`/deals/${dealId}/stage`, { stage_id: newStageId, position: destination.index });
    } catch {
      toast.error('Failed to update stage');
      load();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900">Pipeline</h2>
          {user?.role !== 'sales_rep' && (
            <div className="flex items-center rounded-lg border border-stone-200 bg-stone-50 p-0.5">
              <button
                onClick={() => toggleMyDeals(false)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${!myDeals ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                All Deals
              </button>
              <button
                onClick={() => toggleMyDeals(true)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${myDeals ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                My Deals
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => navigate('/deals/closed')}
          className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
        >
          <Archive size={16} />
          Closed Deals
        </button>
      </div>
      <div
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className="overflow-x-auto overflow-y-hidden mb-3 h-4"
      >
        <div ref={topScrollInnerRef} className="h-px" />
      </div>
      <div className="relative">
        {/* Left arrow - fixed to viewport vertical center, after sidebar */}
        {canScrollLeft && (
          <button
            onClick={() => scroll(-1)}
            className="fixed top-1/2 -translate-y-1/2 z-10 p-2 bg-black/10 hover:bg-black/30 rounded-full transition-colors"
            style={{ left: contentLeft }}
          >
            <ChevronLeft size={24} className="text-white" />
          </button>
        )}

        {/* Right arrow - fixed to viewport vertical center */}
        {canScrollRight && (
          <button
            onClick={() => scroll(1)}
            className="fixed right-1 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/10 hover:bg-black/30 rounded-full transition-colors"
          >
            <ChevronRight size={24} className="text-white" />
          </button>
        )}

        <DragDropContext onDragEnd={handleDragEnd}>
          <div
            ref={scrollRef}
            onScroll={handleMainScroll}
            className="flex gap-4 overflow-x-auto pb-4"
          >
            {visiblePipeline.map((stage) => (
              <div key={stage.id} className="flex-shrink-0 w-72">
                <div className="bg-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm text-gray-700">{stage.name}</h3>
                    <span className="text-xs bg-gray-300 text-gray-600 px-2 py-0.5 rounded-full">{stage.deals.length}</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-3">
                    {fmt(stage.deals.reduce((sum, d) => sum + (d.value || 0), 0))}
                  </div>
                  <Droppable droppableId={String(stage.id)}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-[100px]">
                        {stage.deals.map((deal, i) => (
                          <DealCard key={deal.id} deal={deal} index={i} onClickDeal={(id) => navigate(`/deals/${id}`)} onEditDeal={openEditModal} />
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>

      {/* Edit Deal Modal */}
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
