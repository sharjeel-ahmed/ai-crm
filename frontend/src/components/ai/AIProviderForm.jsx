import { useState, useEffect } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { Zap, CheckCircle, AlertCircle } from 'lucide-react';

const providerModels = {
  'claude-cli': ['claude-cli'],
  claude: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001', 'claude-opus-4-20250514'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  gemini: ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'],
  openrouter: ['anthropic/claude-sonnet-4', 'openai/gpt-4o', 'google/gemini-2.0-flash-001'],
};

export default function AIProviderForm() {
  const [settings, setSettings] = useState([]);
  const [form, setForm] = useState({ provider: 'claude', api_key: '', model: '', is_active: false });
  const [testing, setTesting] = useState(false);

  const loadSettings = () => {
    api.get('/ai-settings').then(r => {
      setSettings(r.data);
      const active = r.data.find(s => s.is_active);
      if (active) {
        setForm({ provider: active.provider, api_key: active.api_key, model: active.model, is_active: true });
      }
    }).catch(() => {});
  };

  useEffect(() => { loadSettings(); }, []);

  const handleProviderChange = (provider) => {
    const existing = settings.find(s => s.provider === provider);
    setForm({
      provider,
      api_key: existing?.api_key || '',
      model: existing?.model || providerModels[provider]?.[0] || '',
      is_active: existing?.is_active || false,
    });
  };

  const handleSave = async () => {
    try {
      await api.put('/ai-settings', form);
      toast.success('AI settings saved');
      loadSettings();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error saving settings');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await api.post('/ai-settings/test', { provider: form.provider });
      toast.success(res.data.message);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const models = providerModels[form.provider] || [];

  return (
    <div className="max-w-xl">
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">AI Provider Configuration</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
          <div className="grid grid-cols-2 gap-2">
            {['claude-cli', 'claude', 'openai', 'gemini', 'openrouter'].map(p => (
              <button
                key={p}
                onClick={() => handleProviderChange(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.provider === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
          <input
            type="password"
            value={form.api_key}
            onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            placeholder="Enter your API key"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
          <select
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ai_active"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="rounded"
          />
          <label htmlFor="ai_active" className="text-sm text-gray-700">Set as active provider</label>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Save Settings
          </button>
          <button onClick={handleTest} disabled={testing} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <Zap size={16} />
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
        </div>

        {settings.length > 0 && (
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Configured Providers</h4>
            <div className="space-y-2">
              {settings.map(s => (
                <div key={s.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {s.is_active ? <CheckCircle size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-gray-400" />}
                    <span className="font-medium">{s.provider}</span>
                    <span className="text-gray-500">{s.model}</span>
                  </div>
                  <span className="text-gray-400">{s.api_key}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
