import { useState } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';

const typeLabels = {
  create_contact: 'Create Contact',
  create_company: 'Create Company',
  create_deal: 'Create Deal',
  log_activity: 'Log Activity',
  update_contact: 'Update Contact',
  move_deal_stage: 'Move Deal Stage',
};

export default function AutoApproveRuleRow({ rule, onUpdated }) {
  const [threshold, setThreshold] = useState(rule.confidence_threshold);
  const [enabled, setEnabled] = useState(!!rule.is_enabled);
  const [saving, setSaving] = useState(false);

  const handleToggle = async () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    setSaving(true);
    try {
      await api.put('/auto-approve', {
        suggestion_type: rule.suggestion_type,
        confidence_threshold: threshold,
        is_enabled: newEnabled,
      });
      onUpdated?.();
    } catch (err) {
      setEnabled(!newEnabled);
      toast.error('Failed to update rule');
    } finally {
      setSaving(false);
    }
  };

  const handleThresholdChange = async (val) => {
    const newThreshold = parseFloat(val);
    setThreshold(newThreshold);
  };

  const handleThresholdCommit = async () => {
    setSaving(true);
    try {
      await api.put('/auto-approve', {
        suggestion_type: rule.suggestion_type,
        confidence_threshold: threshold,
        is_enabled: enabled,
      });
      onUpdated?.();
    } catch (err) {
      toast.error('Failed to update threshold');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow border">
      <div className="flex items-center gap-3">
        <button
          onClick={handleToggle}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            enabled ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
        <span className="text-sm font-medium text-gray-900">
          {typeLabels[rule.suggestion_type] || rule.suggestion_type}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">Threshold:</span>
        <input
          type="range"
          min="0.5"
          max="1"
          step="0.05"
          value={threshold}
          onChange={(e) => handleThresholdChange(e.target.value)}
          onMouseUp={handleThresholdCommit}
          onTouchEnd={handleThresholdCommit}
          className="w-32"
        />
        <span className="text-sm font-medium text-gray-700 w-12 text-right">
          {Math.round(threshold * 100)}%
        </span>
      </div>
    </div>
  );
}
