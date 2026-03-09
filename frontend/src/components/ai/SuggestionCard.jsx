import { User, Building2, Handshake, Activity, PenLine, ArrowRightLeft, Check, X, Pencil, Newspaper } from 'lucide-react';
import ConfidenceBadge from './ConfidenceBadge';

const typeConfig = {
  create_contact: { icon: User, label: 'New Contact', color: 'text-blue-600' },
  create_company: { icon: Building2, label: 'New Company', color: 'text-purple-600' },
  create_deal: { icon: Handshake, label: 'New Deal', color: 'text-green-600' },
  log_activity: { icon: Activity, label: 'Log Activity', color: 'text-orange-600' },
  update_contact: { icon: PenLine, label: 'Update Contact', color: 'text-teal-600' },
  move_deal_stage: { icon: ArrowRightLeft, label: 'Move Deal Stage', color: 'text-indigo-600' },
  newsletter_detected: { icon: Newspaper, label: 'Newsletter Detected', color: 'text-amber-600' },
};

function renderDataPreview(type, data) {
  switch (type) {
    case 'create_contact':
      return (
        <div className="text-sm text-gray-600 space-y-1">
          {data.first_name || data.last_name ? <div><span className="font-medium">Name:</span> {data.first_name} {data.last_name}</div> : null}
          {data.email ? <div><span className="font-medium">Email:</span> {data.email}</div> : null}
          {data.phone ? <div><span className="font-medium">Phone:</span> {data.phone}</div> : null}
          {data.job_title ? <div><span className="font-medium">Title:</span> {data.job_title}</div> : null}
        </div>
      );
    case 'create_company':
      return (
        <div className="text-sm text-gray-600 space-y-1">
          {data.name ? <div><span className="font-medium">Company:</span> {data.name}</div> : null}
          {data.industry ? <div><span className="font-medium">Industry:</span> {data.industry}</div> : null}
          {data.website ? <div><span className="font-medium">Website:</span> {data.website}</div> : null}
        </div>
      );
    case 'create_deal':
      return (
        <div className="text-sm text-gray-600 space-y-1">
          {data.title ? <div><span className="font-medium">Deal:</span> {data.title}</div> : null}
          {data.value ? <div><span className="font-medium">Value:</span> ₹{Number(data.value).toLocaleString('en-IN')}</div> : null}
          {data.notes ? <div><span className="font-medium">Notes:</span> {data.notes}</div> : null}
        </div>
      );
    case 'log_activity':
      return (
        <div className="text-sm text-gray-600 space-y-1">
          {data.type ? <div><span className="font-medium">Type:</span> {data.type}</div> : null}
          {data.subject ? <div><span className="font-medium">Subject:</span> {data.subject}</div> : null}
          {data.description ? <div className="truncate"><span className="font-medium">Description:</span> {data.description}</div> : null}
        </div>
      );
    case 'update_contact':
      return (
        <div className="text-sm text-gray-600 space-y-1">
          {Object.entries(data).filter(([k]) => k !== 'contact_id').map(([k, v]) => (
            <div key={k}><span className="font-medium">{k.replace(/_/g, ' ')}:</span> {v}</div>
          ))}
        </div>
      );
    case 'move_deal_stage':
      return (
        <div className="text-sm text-gray-600 space-y-1">
          {data.deal_id ? <div><span className="font-medium">Deal ID:</span> {data.deal_id}</div> : null}
          {data.stage_id ? <div><span className="font-medium">New Stage ID:</span> {data.stage_id}</div> : null}
        </div>
      );
    case 'newsletter_detected':
      return (
        <div className="text-sm text-gray-600 space-y-1">
          {data.newsletter_name ? <div><span className="font-medium">Newsletter:</span> {data.newsletter_name}</div> : null}
          {data.sender_email ? <div><span className="font-medium">Sender:</span> {data.sender_email}</div> : null}
          {data.sender_name ? <div><span className="font-medium">From:</span> {data.sender_name}</div> : null}
        </div>
      );
    default:
      return <pre className="text-xs text-gray-500">{JSON.stringify(data, null, 2)}</pre>;
  }
}

export default function SuggestionCard({ suggestion, onApprove, onEdit, onDismiss, selectable, selected, onSelect }) {
  const config = typeConfig[suggestion.type] || { icon: Activity, label: suggestion.type, color: 'text-gray-600' };
  const Icon = config.icon;
  const data = typeof suggestion.data === 'string' ? JSON.parse(suggestion.data) : suggestion.data;
  const isPending = suggestion.status === 'pending';

  return (
    <div className={`bg-white rounded-lg shadow border p-4 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {selectable && isPending && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onSelect?.(suggestion.id)}
              className="mt-1 rounded"
            />
          )}
          <div className={`p-2 rounded-lg bg-gray-50 ${config.color}`}>
            <Icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm text-gray-900">{config.label}</span>
              <ConfidenceBadge confidence={suggestion.confidence} />
              {suggestion.status !== 'pending' && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  suggestion.status === 'approved' || suggestion.status === 'auto_approved'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {suggestion.type === 'newsletter_detected' && suggestion.status === 'auto_approved'
                    ? 'sender ignored'
                    : suggestion.status.replace('_', ' ')}
                </span>
              )}
            </div>
            {renderDataPreview(suggestion.type, data)}
            {suggestion.reasoning && (
              <p className="text-xs text-gray-400 mt-2 italic">{suggestion.reasoning}</p>
            )}
            {suggestion.email_subject && (
              <div className="text-xs text-gray-400 mt-1">
                From: {suggestion.email_from_name || suggestion.email_from} | {suggestion.email_subject}
                {suggestion.email_date && (
                  <span className="ml-2">{new Date(suggestion.email_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} {new Date(suggestion.email_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </div>
            )}
          </div>
        </div>
        {isPending && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onApprove?.(suggestion.id)} title="Approve" className="p-1.5 rounded-lg text-green-600 hover:bg-green-50">
              <Check size={18} />
            </button>
            <button onClick={() => onEdit?.(suggestion)} title="Edit & Approve" className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50">
              <Pencil size={18} />
            </button>
            <button onClick={() => onDismiss?.(suggestion.id)} title="Dismiss" className="p-1.5 rounded-lg text-red-600 hover:bg-red-50">
              <X size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
