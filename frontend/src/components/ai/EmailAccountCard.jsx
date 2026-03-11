import { useState } from 'react';
import { Mail, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import api from '../../api/client';
import { formatDateTime } from '../../utils/dateFormat';
import toast from 'react-hot-toast';

export default function EmailAccountCard({ account, onRemoved }) {
  const [syncing, setSyncing] = useState(false);
  const [resyncing, setResyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post(`/email-accounts/${account.id}/sync`);
      toast.success(`Synced ${res.data.synced} emails`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleResync = async () => {
    if (!confirm('This will clear all synced emails and re-fetch the last 3 days. Continue?')) return;
    setResyncing(true);
    try {
      const res = await api.post(`/email-accounts/${account.id}/resync`);
      toast.success(`Re-synced ${res.data.synced} emails from last 3 days`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Resync failed');
    } finally {
      setResyncing(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Disconnect this email account? Synced emails and suggestions will remain.')) return;
    try {
      await api.delete(`/email-accounts/${account.id}`);
      toast.success('Account disconnected');
      onRemoved?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow border p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
          <Mail size={20} />
        </div>
        <div>
          <div className="font-medium text-gray-900">{account.email_address}</div>
          <div className="text-xs text-gray-500">
            {account.last_sync_at ? `Last synced: ${formatDateTime(account.last_sync_at)}` : 'Never synced'}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleSync}
          disabled={syncing || resyncing}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
        <button
          onClick={handleResync}
          disabled={syncing || resyncing}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 disabled:opacity-50"
          title="Clear and re-fetch last 3 days"
        >
          <RotateCcw size={14} className={resyncing ? 'animate-spin' : ''} />
          {resyncing ? 'Re-syncing...' : 'Resync'}
        </button>
        <button
          onClick={handleRemove}
          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
          title="Disconnect"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
