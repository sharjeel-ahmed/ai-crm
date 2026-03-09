export default function ConfidenceBadge({ confidence }) {
  const pct = Math.round(confidence * 100);
  let colorClass = 'bg-red-100 text-red-700';
  if (pct >= 80) colorClass = 'bg-green-100 text-green-700';
  else if (pct >= 50) colorClass = 'bg-yellow-100 text-yellow-700';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {pct}%
    </span>
  );
}
