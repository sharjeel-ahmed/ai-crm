import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { formatDate } from '../utils/dateFormat';
import Modal from '../components/common/Modal';
import { Plus, Pencil, Trash2, Users, Layers, Mail, Bot, Shield, MessageSquareText, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import AIProviderForm from '../components/ai/AIProviderForm';
import EmailAccountCard from '../components/ai/EmailAccountCard';
import AutoApproveRuleRow from '../components/ai/AutoApproveRuleRow';
import usePageTitle from '../hooks/usePageTitle';

export default function SettingsPage() {
  usePageTitle('Settings');
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'email' ? 'email' : 'users';
  const [tab, setTab] = useState(initialTab);
  const [users, setUsers] = useState([]);
  const [stages, setStages] = useState([]);
  const [userModal, setUserModal] = useState(false);
  const [stageModal, setStageModal] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'sales_rep' });
  const [stageForm, setStageForm] = useState({ name: '', display_order: '', is_closed: false });
  const [editingUser, setEditingUser] = useState(null);
  const [editingStage, setEditingStage] = useState(null);
  const [emailAccounts, setEmailAccounts] = useState([]);
  const [autoApproveRules, setAutoApproveRules] = useState([]);
  const [promptData, setPromptData] = useState({ custom_prompt: '', default_prompt: '' });
  const [promptSaving, setPromptSaving] = useState(false);
  const [ignoreList, setIgnoreList] = useState([]);
  const [ignoreForm, setIgnoreForm] = useState({ email_address: '', reason: '' });

  const loadUsers = () => api.get('/users').then((r) => setUsers(r.data));
  const loadStages = () => api.get('/stages').then((r) => setStages(r.data));
  const loadEmailAccounts = () => api.get('/email-accounts').then(r => setEmailAccounts(r.data)).catch(() => {});
  const loadAutoApproveRules = () => api.get('/auto-approve').then(r => setAutoApproveRules(r.data)).catch(() => {});
  const loadPrompt = () => api.get('/ai-settings/prompt').then(r => setPromptData(r.data)).catch(() => {});
  const loadIgnoreList = () => api.get('/ignore-list').then(r => setIgnoreList(r.data)).catch(() => {});

  useEffect(() => { loadUsers(); loadStages(); loadEmailAccounts(); loadAutoApproveRules(); loadPrompt(); loadIgnoreList(); }, []);

  // Show success toast if redirected from OAuth
  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      toast.success('Email account connected!');
      loadEmailAccounts();
    }
    if (searchParams.get('error')) {
      toast.error(`Connection failed: ${searchParams.get('error')}`);
    }
  }, []);

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const payload = { ...userForm };
        if (!payload.password) delete payload.password;
        await api.put(`/users/${editingUser}`, payload);
        toast.success('User updated');
      } else {
        await api.post('/users', userForm);
        toast.success('User created');
      }
      setUserModal(false);
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const handleStageSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...stageForm, display_order: parseInt(stageForm.display_order) || undefined };
      if (editingStage) {
        await api.put(`/stages/${editingStage}`, payload);
        toast.success('Stage updated');
      } else {
        await api.post('/stages', payload);
        toast.success('Stage created');
      }
      setStageModal(false);
      setEditingStage(null);
      loadStages();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const deleteUser = async (id) => {
    if (!confirm('Delete this user?')) return;
    try { await api.delete(`/users/${id}`); toast.success('User deleted'); loadUsers(); }
    catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const deleteStage = async (id) => {
    if (!confirm('Delete this stage?')) return;
    try { await api.delete(`/stages/${id}`); toast.success('Stage deleted'); loadStages(); }
    catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const connectGmail = async () => {
    try {
      const res = await api.get('/email-accounts/auth-url');
      window.location.href = res.data.url;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start Gmail connection');
    }
  };

  const tabs = [
    { id: 'users', icon: Users, label: 'Users' },
    { id: 'stages', icon: Layers, label: 'Deal Stages' },
    { id: 'email', icon: Mail, label: 'Email Accounts' },
    { id: 'ai', icon: Bot, label: 'AI Provider' },
    { id: 'auto-approve', icon: Shield, label: 'Auto-Approve' },
    { id: 'prompt', icon: MessageSquareText, label: 'AI Prompt' },
    { id: 'ignore-list', icon: EyeOff, label: 'Ignore List' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border hover:bg-gray-50'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => { setUserForm({ name: '', email: '', password: '', role: 'sales_rep' }); setEditingUser(null); setUserModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus size={20} /> Add User
            </button>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{u.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                    <td className="px-6 py-4 text-sm"><span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100">{u.role}</span></td>
                    <td className="px-6 py-4 text-sm"><span className={`px-2 py-1 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button onClick={() => { setUserForm({ name: u.name, email: u.email, password: '', role: u.role }); setEditingUser(u.id); setUserModal(true); }} className="text-blue-600 hover:text-blue-800"><Pencil size={16} /></button>
                        <button onClick={() => deleteUser(u.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'stages' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => { setStageForm({ name: '', display_order: '', is_closed: false }); setEditingStage(null); setStageModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus size={20} /> Add Stage
            </button>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stages.map((s) => (
                  <tr key={s.id}>
                    <td className="px-6 py-4 text-sm text-gray-500">{s.display_order}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{s.name}</td>
                    <td className="px-6 py-4 text-sm"><span className={`px-2 py-1 rounded-full text-xs font-medium ${s.is_closed ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>{s.is_closed ? 'Closed' : 'Open'}</span></td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button onClick={() => { setStageForm({ name: s.name, display_order: s.display_order, is_closed: !!s.is_closed }); setEditingStage(s.id); setStageModal(true); }} className="text-blue-600 hover:text-blue-800"><Pencil size={16} /></button>
                        <button onClick={() => deleteStage(s.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'email' && (
        <div className="max-w-xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Connected Email Accounts</h3>
            <button onClick={connectGmail} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Mail size={16} /> Connect Gmail
            </button>
          </div>
          {emailAccounts.length === 0 ? (
            <div className="bg-white rounded-lg shadow border p-8 text-center">
              <Mail size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No email accounts connected</p>
              <p className="text-sm text-gray-400 mt-1">Connect your Gmail to start syncing emails for AI analysis</p>
            </div>
          ) : (
            <div className="space-y-3">
              {emailAccounts.map(a => (
                <EmailAccountCard key={a.id} account={a} onRemoved={loadEmailAccounts} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'ai' && <AIProviderForm />}

      {tab === 'auto-approve' && (
        <div className="max-w-xl">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Auto-Approve Rules</h3>
            <p className="text-sm text-gray-500 mt-1">
              Enable auto-approval for suggestion types when confidence exceeds the threshold.
            </p>
          </div>
          <div className="space-y-3">
            {autoApproveRules.map(rule => (
              <AutoApproveRuleRow key={rule.id} rule={rule} onUpdated={loadAutoApproveRules} />
            ))}
          </div>
        </div>
      )}

      {tab === 'prompt' && (
        <div className="max-w-3xl">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">AI Extraction Prompt</h3>
            <p className="text-sm text-gray-500 mt-1">
              Customize how the AI analyzes emails. Edit the prompt below to teach the AI what to look for, what to ignore, and how to categorize leads. Leave empty to use the default prompt.
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Custom Prompt</label>
                <button
                  onClick={() => setPromptData({ ...promptData, custom_prompt: promptData.default_prompt })}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Copy default to edit
                </button>
              </div>
              <textarea
                value={promptData.custom_prompt}
                onChange={(e) => setPromptData({ ...promptData, custom_prompt: e.target.value })}
                placeholder="Leave empty to use the default prompt..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={18}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  setPromptSaving(true);
                  try {
                    await api.put('/ai-settings/prompt', { custom_prompt: promptData.custom_prompt });
                    toast.success('AI prompt saved. New emails will use this prompt.');
                  } catch (err) {
                    toast.error(err.response?.data?.error || 'Error saving prompt');
                  } finally {
                    setPromptSaving(false);
                  }
                }}
                disabled={promptSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {promptSaving ? 'Saving...' : 'Save Prompt'}
              </button>
              <button
                onClick={() => {
                  setPromptData({ ...promptData, custom_prompt: '' });
                  api.put('/ai-settings/prompt', { custom_prompt: '' }).then(() => {
                    toast.success('Reset to default prompt');
                  });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Reset to Default
              </button>
            </div>
            <details className="mt-4">
              <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">View default prompt</summary>
              <pre className="mt-2 p-4 bg-gray-50 rounded-lg text-xs text-gray-600 whitespace-pre-wrap font-mono overflow-auto max-h-96">
                {promptData.default_prompt}
              </pre>
            </details>
          </div>
        </div>
      )}

      {tab === 'ignore-list' && (
        <div className="max-w-xl">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Email Ignore List</h3>
            <p className="text-sm text-gray-500 mt-1">
              Emails from or to these addresses will be skipped during AI processing.
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.post('/ignore-list', ignoreForm);
                toast.success('Added to ignore list');
                setIgnoreForm({ email_address: '', reason: '' });
                loadIgnoreList();
              } catch (err) {
                toast.error(err.response?.data?.error || 'Error');
              }
            }} className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={ignoreForm.email_address}
                  onChange={(e) => setIgnoreForm({ ...ignoreForm, email_address: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={ignoreForm.reason}
                  onChange={(e) => setIgnoreForm({ ...ignoreForm, reason: e.target.value })}
                  placeholder="e.g. Newsletter, Spam"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button type="submit" className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shrink-0">
                <Plus size={16} /> Add
              </button>
            </form>
          </div>
          {ignoreList.length === 0 ? (
            <div className="bg-white rounded-lg shadow border p-8 text-center">
              <EyeOff size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No emails in the ignore list</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full table-fixed divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-1/3 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="w-1/3 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                    <th className="w-1/5 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Added</th>
                    <th className="w-16 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ignoreList.map(item => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 truncate">{item.email_address}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 truncate">{item.reason || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-400 whitespace-nowrap">{formatDate(item.created_at + 'Z')}</td>
                      <td className="px-6 py-4 text-sm">
                        <button onClick={async () => {
                          try {
                            await api.delete(`/ignore-list/${item.id}`);
                            toast.success('Removed from ignore list');
                            loadIgnoreList();
                          } catch (err) {
                            toast.error('Error removing');
                          }
                        }} className="text-red-600 hover:text-red-800">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={userModal} onClose={() => setUserModal(false)} title={editingUser ? 'Edit User' : 'New User'}>
        <form onSubmit={handleUserSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input type="text" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password {editingUser && '(leave blank to keep current)'}</label>
            <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required={!editingUser} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="sales_rep">Sales Rep</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setUserModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={stageModal} onClose={() => setStageModal(false)} title={editingStage ? 'Edit Stage' : 'New Stage'}>
        <form onSubmit={handleStageSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stage Name</label>
            <input type="text" value={stageForm.name} onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
            <input type="number" value={stageForm.display_order} onChange={(e) => setStageForm({ ...stageForm, display_order: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={stageForm.is_closed} onChange={(e) => setStageForm({ ...stageForm, is_closed: e.target.checked })} className="rounded" id="is_closed" />
            <label htmlFor="is_closed" className="text-sm text-gray-700">Closed stage (Won/Lost)</label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setStageModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
