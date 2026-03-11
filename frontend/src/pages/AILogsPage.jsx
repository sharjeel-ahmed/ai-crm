import { useState, useEffect } from 'react';
import api from '../api/client';
import { ScrollText, Mail, MailOpen, Clock, Sparkles, Ban, ChevronDown, ChevronRight, MessageSquare, Code, EyeOff, Trash2, ChevronsRight } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfidenceBadge from '../components/ai/ConfidenceBadge';

const actionConfig = {
  pending: { label: 'Awaiting AI', icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
  no_action: { label: 'No CRM data found', icon: Ban, color: 'text-gray-500 bg-gray-50' },
  suggestions_created: { label: 'Suggestions created', icon: Sparkles, color: 'text-blue-600 bg-blue-50' },
};

const suggestionTypeLabels = {
  create_contact: 'Create Contact',
  create_company: 'Create Company',
  create_deal: 'Create Deal',
  log_activity: 'Log Activity',
  update_contact: 'Update Contact',
  move_deal_stage: 'Move Deal Stage',
};

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  auto_approved: 'bg-blue-100 text-blue-700',
  dismissed: 'bg-gray-100 text-gray-600',
};

function tryFormatJSON(str) {
  if (!str) return str;
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

export default function AILogsPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(new Set());
  const [activeTab, setActiveTab] = useState({});

  useEffect(() => {
    setLoading(true);
    api.get('/ai-logs?limit=100').then(r => {
      setLogs(r.data.logs);
      setTotal(r.data.total);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getTab = (id) => activeTab[id] || 'prompt';
  const setTab = (id, tab) => setActiveTab(prev => ({ ...prev, [id]: tab }));

  const handleDelete = async (id) => {
    if (!confirm('Delete this email log? It will be re-synced on next sync.')) return;
    try {
      await api.delete(`/ai-logs/${id}`);
      setLogs(prev => prev.filter(l => l.id !== id));
      setTotal(prev => prev - 1);
      toast.success('Log deleted — will re-sync next time');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error deleting log');
    }
  };

  const handleDeleteFromHere = async (log) => {
    if (!confirm(`Delete this and all newer email logs? They will be re-synced on next sync.`)) return;
    try {
      const res = await api.delete(`/ai-logs/${log.id}/from-here`);
      setLogs(prev => prev.filter(l => l.id < log.id));
      setTotal(prev => prev - (res.data.deleted || 1));
      toast.success(`${res.data.deleted} log(s) deleted — will re-sync next time`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error deleting logs');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <ScrollText size={24} className="text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900">AI Logs</h2>
        <span className="text-sm text-gray-500 ml-2">{total} emails processed</span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <ScrollText size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No emails synced yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            const action = actionConfig[log.action] || actionConfig.pending;
            const ActionIcon = action.icon;
            const isExpanded = expanded.has(log.id);
            const hasSuggestions = log.suggestions.length > 0;
            const hasAIData = log.ai_prompt || log.ai_response;
            const canExpand = hasSuggestions || hasAIData;
            const tab = getTab(log.id);

            return (
              <div key={log.id} className="bg-white rounded-lg shadow border">
                <button
                  onClick={() => canExpand && toggleExpand(log.id)}
                  className={`w-full flex items-center gap-3 p-4 text-left ${canExpand ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}`}
                >
                  {/* Expand icon */}
                  <div className="w-5 shrink-0">
                    {canExpand ? (
                      isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />
                    ) : null}
                  </div>

                  {/* Inbound/Outbound icon */}
                  <div className={`p-1.5 rounded ${log.is_inbound ? 'text-green-600 bg-green-50' : 'text-blue-600 bg-blue-50'}`}>
                    {log.is_inbound ? <Mail size={16} /> : <MailOpen size={16} />}
                  </div>

                  {/* Email info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{log.subject || '(no subject)'}</span>
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {log.is_inbound ? 'From' : 'To'}: {log.from_name || log.from_address}
                      <span className="mx-2">|</span>
                      {log.date ? new Date(log.date).toLocaleString() : ''}
                      {log.synced_at && (
                        <>
                          <span className="mx-2">|</span>
                          <span className="text-gray-400">Synced: {new Date(log.synced_at + 'Z').toLocaleString()}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {log.from_address && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!confirm(`Add ${log.from_address} to the ignore list?`)) return;
                          api.post('/ignore-list', { email_address: log.from_address, reason: `From AI Logs: ${log.subject || '(no subject)'}` })
                            .then(() => toast.success(`${log.from_address} added to ignore list`))
                            .catch(err => toast.error(err.response?.data?.error || 'Error'));
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                        title={`Ignore ${log.from_address}`}
                      >
                        <EyeOff size={14} />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(log.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete and re-sync this email"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteFromHere(log); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete this and all newer emails (re-sync from here)"
                    >
                      <ChevronsRight size={14} />
                    </button>
                  </div>

                  {/* Action badge */}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${action.color}`}>
                    <ActionIcon size={12} />
                    {action.label}
                    {hasSuggestions && <span className="ml-0.5">({log.suggestions.length})</span>}
                  </div>
                </button>

                {/* Expanded detail panel */}
                {isExpanded && canExpand && (
                  <div className="border-t px-4 pb-4 pt-3 ml-12">
                    {/* Tabs */}
                    {hasAIData && (
                      <div className="flex gap-1 mb-3 border-b">
                        <button
                          onClick={() => setTab(log.id, 'prompt')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                            tab === 'prompt' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <MessageSquare size={12} />
                          Prompt Input
                        </button>
                        <button
                          onClick={() => setTab(log.id, 'response')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                            tab === 'response' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <Code size={12} />
                          AI Response
                        </button>
                        {hasSuggestions && (
                          <button
                            onClick={() => setTab(log.id, 'suggestions')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                              tab === 'suggestions' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            <Sparkles size={12} />
                            Suggestions ({log.suggestions.length})
                          </button>
                        )}
                      </div>
                    )}

                    {/* Prompt tab */}
                    {tab === 'prompt' && hasAIData && (
                      <div className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap max-h-96 overflow-auto">
                        {log.ai_prompt || 'No prompt recorded'}
                      </div>
                    )}

                    {/* Response tab */}
                    {tab === 'response' && hasAIData && (
                      <div className="bg-gray-900 text-green-300 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap max-h-96 overflow-auto">
                        {tryFormatJSON(log.ai_response) || 'No response recorded'}
                      </div>
                    )}

                    {/* Suggestions tab (or default if no AI data) */}
                    {((tab === 'suggestions' && hasSuggestions) || (!hasAIData && hasSuggestions)) && (
                      <div>
                        <div className="text-xs font-medium text-gray-500 mb-2 uppercase">AI Suggestions</div>
                        <div className="space-y-2">
                          {log.suggestions.map(s => (
                            <div key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                              <div className="flex items-center gap-3">
                                <span className="font-medium text-gray-700">{suggestionTypeLabels[s.type] || s.type}</span>
                                <ConfidenceBadge confidence={s.confidence} />
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[s.status] || ''}`}>
                                  {s.status.replace('_', ' ')}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400 italic max-w-xs truncate">{s.reasoning}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
