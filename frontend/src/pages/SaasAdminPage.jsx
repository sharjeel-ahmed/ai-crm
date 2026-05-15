import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Building2,
  Copy,
  KeyRound,
  Mail,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import api from '../api/client';
import usePageTitle from '../hooks/usePageTitle';

const emptyClientForm = {
  name: '',
  slug: '',
  admin_name: '',
  admin_email: '',
  admin_password: '',
};

export default function SaasAdminPage() {
  usePageTitle('SaaS Admin');
  const [clients, setClients] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [clientForm, setClientForm] = useState(emptyClientForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [latestAccess, setLatestAccess] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [clientsRes, usersRes] = await Promise.all([
        api.get('/clients'),
        api.get('/users'),
      ]);
      setClients(clientsRes.data);
      setAccounts(usersRes.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load SaaS admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateClient = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/clients', clientForm);
      setLatestAccess({
        client: res.data.client,
        user: res.data.primary_user,
        password: clientForm.admin_password,
      });
      setClientForm(emptyClientForm);
      toast.success('Client workspace created');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create client workspace');
    } finally {
      setSaving(false);
    }
  };

  const copyAccess = async () => {
    if (!latestAccess) return;
    const text = [
      `Client: ${latestAccess.client.name}`,
      `Workspace: ${latestAccess.client.slug}`,
      `Login: ${latestAccess.user.email}`,
      `Password: ${latestAccess.password}`,
      `Role: ${latestAccess.user.role}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Access copied');
    } catch {
      toast.error('Clipboard copy failed');
    }
  };

  const activeClients = clients.filter((client) => client.is_active).length;
  const clientAdmins = accounts.filter((account) => account.client_id && account.role === 'admin').length;
  const clientUsers = accounts.filter((account) => account.client_id).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">SaaS Admin</h2>
        <p className="text-sm text-gray-500 mt-1">
          Create isolated client workspaces, each with its own login, data scope, and CRM records.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Building2} label="Clients" value={clients.length} tone="amber" />
        <StatCard icon={ShieldCheck} label="Active Clients" value={activeClients} tone="emerald" />
        <StatCard icon={Users} label="Client Logins" value={clientUsers} tone="blue" />
        <StatCard icon={KeyRound} label="Client Admins" value={clientAdmins} tone="slate" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="bg-white rounded-2xl shadow border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Plus size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Create Client Workspace</h3>
              <p className="text-sm text-gray-500">This creates the client tenant and its first admin login in one step.</p>
            </div>
          </div>

          <form onSubmit={handleCreateClient} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
              <input
                type="text"
                value={clientForm.name}
                onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Acme Interiors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Workspace Slug</label>
              <input
                type="text"
                value={clientForm.slug}
                onChange={(e) => setClientForm({ ...clientForm, slug: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="acme-interiors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Admin Name</label>
              <input
                type="text"
                value={clientForm.admin_name}
                onChange={(e) => setClientForm({ ...clientForm, admin_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Aisha Khan"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Admin Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={clientForm.admin_email}
                  onChange={(e) => setClientForm({ ...clientForm, admin_email: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="owner@acme.com"
                  required
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Admin Password</label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={clientForm.admin_password}
                  onChange={(e) => setClientForm({ ...clientForm, admin_password: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Create a password"
                  minLength={6}
                  required
                />
              </div>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus size={16} />
                {saving ? 'Creating...' : 'Create Client'}
              </button>
            </div>
          </form>
        </section>

        <section className="bg-gray-950 text-gray-100 rounded-2xl shadow border border-gray-900 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-white/10 text-amber-300 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Latest Client Access</h3>
              <p className="text-sm text-gray-400">Share these credentials with the new client admin.</p>
            </div>
          </div>

          {latestAccess ? (
            <div className="space-y-4">
              <AccessRow label="Client" value={latestAccess.client.name} />
              <AccessRow label="Workspace" value={latestAccess.client.slug} monospace />
              <AccessRow label="Login" value={latestAccess.user.email} monospace />
              <AccessRow label="Password" value={latestAccess.password} monospace />
              <button
                type="button"
                onClick={copyAccess}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-gray-950 font-medium hover:bg-gray-200"
              >
                <Copy size={16} />
                Copy Access
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-5 text-sm text-gray-400">
              Create a client to show its first login here.
            </div>
          )}
        </section>
      </div>

      <section className="bg-white rounded-2xl shadow border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Client Workspaces</h3>
          <p className="text-sm text-gray-500 mt-1">Each client below now has its own `client_id` boundary in the backend.</p>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-sm text-gray-500">Loading clients...</div>
        ) : clients.length === 0 ? (
          <div className="px-6 py-12 text-sm text-gray-500">No client workspaces created yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Workspace</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Companies</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{client.name}</div>
                      <div className="text-xs text-gray-400">Client #{client.id}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{client.slug}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${client.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                        {client.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{client.user_count}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{client.company_count}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{client.deal_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl shadow border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Tenant Users</h3>
          <p className="text-sm text-gray-500 mt-1">These are the users attached to client workspaces.</p>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-sm text-gray-500">Loading users...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {accounts.filter((account) => account.client_id).map((account) => (
                  <tr key={account.id}>
                    <td className="px-6 py-4 font-medium text-gray-900">{account.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{account.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{account.role}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{account.client_name || 'Unknown client'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${account.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                        {account.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}


function StatCard({ icon, label, value, tone }) {
  const Icon = icon;
  const toneClasses = {
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <div className="bg-white rounded-2xl shadow border border-gray-200 p-5">
      <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${toneClasses[tone]}`}>
        <Icon size={20} />
      </div>
      <div className="mt-4 text-3xl font-semibold text-gray-900">{value}</div>
      <div className="mt-1 text-sm text-gray-500">{label}</div>
    </div>
  );
}

function AccessRow({ label, value, monospace = false }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.18em] text-gray-500">{label}</div>
      <div className={`mt-1 text-sm text-white break-all ${monospace ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}
