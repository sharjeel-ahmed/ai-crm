import { useState, useEffect } from 'react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { Sparkles, Filter, CheckCheck, XCircle } from 'lucide-react';
import SuggestionCard from '../components/ai/SuggestionCard';
import SuggestionEditModal from '../components/ai/SuggestionEditModal';
import usePageTitle from '../hooks/usePageTitle';

export default function AIInboxPage() {
  usePageTitle('AI Inbox');
  const [suggestions, setSuggestions] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, auto_approved: 0, dismissed: 0 });
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState({ status: 'pending', type: '', min_confidence: '' });
  const [selected, setSelected] = useState(new Set());
  const [editSuggestion, setEditSuggestion] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.status) params.set('status', filter.status);
      if (filter.type) params.set('type', filter.type);
      if (filter.min_confidence) params.set('min_confidence', filter.min_confidence);
      const res = await api.get(`/suggestions?${params.toString()}`);
      setSuggestions(res.data.suggestions);
      setTotal(res.data.total);
    } catch (err) {
      toast.error('Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = () => {
    api.get('/suggestions/stats').then(r => setStats(r.data)).catch(() => {});
  };

  useEffect(() => { loadSuggestions(); loadStats(); }, [filter]);

  const handleApprove = async (id) => {
    try {
      await api.post(`/suggestions/${id}/approve`);
      toast.success('Suggestion approved');
      loadSuggestions();
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const handleDismiss = async (id) => {
    try {
      await api.post(`/suggestions/${id}/dismiss`);
      toast.success('Suggestion dismissed');
      loadSuggestions();
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const handleEditSave = async (id, data) => {
    try {
      await api.post(`/suggestions/${id}/approve-with-edits`, { data });
      toast.success('Suggestion approved with edits');
      setEditSuggestion(null);
      loadSuggestions();
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === suggestions.filter(s => s.status === 'pending').length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(suggestions.filter(s => s.status === 'pending').map(s => s.id)));
    }
  };

  const handleBulkApprove = async () => {
    if (selected.size === 0) return;
    try {
      await api.post('/suggestions/bulk-approve', { ids: [...selected] });
      toast.success(`${selected.size} suggestions approved`);
      setSelected(new Set());
      loadSuggestions();
      loadStats();
    } catch (err) {
      toast.error('Bulk approve failed');
    }
  };

  const handleBulkDismiss = async () => {
    if (selected.size === 0) return;
    try {
      await api.post('/suggestions/bulk-dismiss', { ids: [...selected] });
      toast.success(`${selected.size} suggestions dismissed`);
      setSelected(new Set());
      loadSuggestions();
      loadStats();
    } catch (err) {
      toast.error('Bulk dismiss failed');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Sparkles size={24} className="text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">AI Inbox</h2>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-yellow-600 font-medium">{stats.pending} pending</span>
          <span className="text-green-600">{stats.approved} approved</span>
          <span className="text-blue-600">{stats.auto_approved} auto</span>
          <span className="text-gray-500">{stats.dismissed} dismissed</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <Filter size={14} />
          <span>Filters:</span>
        </div>
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="auto_approved">Auto Approved</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select
          value={filter.type}
          onChange={(e) => setFilter({ ...filter, type: e.target.value })}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          <option value="create_contact">Contact</option>
          <option value="create_company">Company</option>
          <option value="create_deal">Deal</option>
          <option value="log_activity">Activity</option>
          <option value="update_contact">Update Contact</option>
          <option value="move_deal_stage">Move Stage</option>
          <option value="newsletter_detected">Newsletter</option>
        </select>
        <select
          value={filter.min_confidence}
          onChange={(e) => setFilter({ ...filter, min_confidence: e.target.value })}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Any Confidence</option>
          <option value="0.9">90%+</option>
          <option value="0.8">80%+</option>
          <option value="0.5">50%+</option>
        </select>
      </div>

      {/* Bulk actions */}
      {filter.status === 'pending' && suggestions.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <button onClick={selectAll} className="text-sm text-blue-600 hover:underline">
            {selected.size === suggestions.filter(s => s.status === 'pending').length ? 'Deselect All' : 'Select All'}
          </button>
          {selected.size > 0 && (
            <>
              <span className="text-sm text-gray-500">{selected.size} selected</span>
              <button onClick={handleBulkApprove} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                <CheckCheck size={14} /> Approve All
              </button>
              <button onClick={handleBulkDismiss} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                <XCircle size={14} /> Dismiss All
              </button>
            </>
          )}
        </div>
      )}

      {/* Suggestion list */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : suggestions.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No suggestions yet</p>
          <p className="text-sm text-gray-400 mt-1">Connect an email account and configure an AI provider to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              onApprove={handleApprove}
              onEdit={setEditSuggestion}
              onDismiss={handleDismiss}
              selectable={filter.status === 'pending'}
              selected={selected.has(s.id)}
              onSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      <SuggestionEditModal
        isOpen={!!editSuggestion}
        onClose={() => setEditSuggestion(null)}
        suggestion={editSuggestion}
        onSave={handleEditSave}
      />
    </div>
  );
}
