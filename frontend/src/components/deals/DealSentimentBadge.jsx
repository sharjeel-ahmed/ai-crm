const sentimentStyles = {
  positive: 'bg-emerald-100 text-emerald-700',
  negative: 'bg-rose-100 text-rose-700',
  neutral: 'bg-slate-100 text-slate-700',
};

export default function DealSentimentBadge({ sentiment }) {
  const normalized = ['positive', 'negative', 'neutral'].includes(sentiment) ? sentiment : 'neutral';

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${sentimentStyles[normalized]}`}>
      {normalized}
    </span>
  );
}
