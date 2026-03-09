import { useState, useEffect } from 'react';
import Modal from '../common/Modal';

const fieldsByType = {
  create_contact: ['first_name', 'last_name', 'email', 'phone', 'job_title'],
  create_company: ['name', 'industry', 'website', 'phone', 'address'],
  create_deal: ['title', 'value', 'notes'],
  log_activity: ['type', 'subject', 'description'],
  update_contact: ['first_name', 'last_name', 'email', 'phone', 'job_title'],
  move_deal_stage: ['deal_id', 'stage_id'],
};

const fieldLabels = {
  first_name: 'First Name', last_name: 'Last Name', email: 'Email', phone: 'Phone',
  job_title: 'Job Title', name: 'Name', industry: 'Industry', website: 'Website',
  address: 'Address', title: 'Title', value: 'Value', notes: 'Notes',
  type: 'Activity Type', subject: 'Subject', description: 'Description',
  deal_id: 'Deal ID', stage_id: 'Stage ID',
};

export default function SuggestionEditModal({ isOpen, onClose, suggestion, onSave }) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (suggestion) {
      const data = typeof suggestion.data === 'string' ? JSON.parse(suggestion.data) : suggestion.data;
      setFormData({ ...data });
    }
  }, [suggestion]);

  if (!suggestion) return null;

  const fields = fieldsByType[suggestion.type] || Object.keys(formData);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave?.(suggestion.id, formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit & Approve Suggestion">
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field) => (
          <div key={field}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {fieldLabels[field] || field.replace(/_/g, ' ')}
            </label>
            {field === 'description' || field === 'notes' ? (
              <textarea
                value={formData[field] || ''}
                onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            ) : field === 'type' && suggestion.type === 'log_activity' ? (
              <select
                value={formData[field] || 'email'}
                onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
                <option value="note">Note</option>
                <option value="task">Task</option>
              </select>
            ) : (
              <input
                type={field === 'value' ? 'number' : 'text'}
                value={formData[field] || ''}
                onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        ))}
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Approve with Edits
          </button>
        </div>
      </form>
    </Modal>
  );
}
