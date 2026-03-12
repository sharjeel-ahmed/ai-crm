function normalizeEmailAddress(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  const match = trimmed.match(/<([^>]+)>/);
  return (match ? match[1] : trimmed).trim().toLowerCase() || null;
}

function parseEmailArray(value) {
  if (!value) return [];

  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value.split(',');
    }
  }

  const values = Array.isArray(parsed) ? parsed : [parsed];
  return values
    .map(normalizeEmailAddress)
    .filter(Boolean);
}

function deriveSentiment(emails) {
  if (!emails.length) {
    return { sentiment: 'neutral', score: 0 };
  }

  const sortedEmails = [...emails].sort((a, b) => new Date(a.date || a.created_at || 0) - new Date(b.date || b.created_at || 0));
  let score = 0;

  for (const email of sortedEmails) {
    const label = email.ai_sentiment || 'neutral';
    const confidence = Number(email.ai_sentiment_confidence || 0);
    const weight = email.is_inbound ? 1.25 : 1;
    if (label === 'positive') score += Math.max(confidence, 0.5) * weight;
    if (label === 'negative') score -= Math.max(confidence, 0.5) * weight;
  }

  const latestOutbound = [...sortedEmails].reverse().find((email) => !email.is_inbound);
  const latestInbound = [...sortedEmails].reverse().find((email) => email.is_inbound);

  if (latestOutbound) {
    const outboundTime = new Date(latestOutbound.date || latestOutbound.created_at || 0).getTime();
    const inboundAfterOutbound = sortedEmails.find((email) => email.is_inbound && new Date(email.date || email.created_at || 0).getTime() > outboundTime);

    if (inboundAfterOutbound) {
      score += 2;
    } else if (Date.now() - outboundTime > 5 * 24 * 60 * 60 * 1000) {
      score -= 2;
    }
  }

  if (latestInbound) {
    const latestInboundTime = new Date(latestInbound.date || latestInbound.created_at || 0).getTime();
    if (Date.now() - latestInboundTime <= 7 * 24 * 60 * 60 * 1000) {
      score += 1;
    }
  }

  if (score >= 2) return { sentiment: 'positive', score };
  if (score <= -2) return { sentiment: 'negative', score };
  return { sentiment: 'neutral', score };
}

function getRelatedEmailsForDeal(db, deal) {
  if (!deal?.company_id) return [];

  const contactEmails = db.prepare('SELECT email FROM contacts WHERE company_id = ? AND email IS NOT NULL AND TRIM(email) <> \'\'').all(deal.company_id)
    .map((row) => normalizeEmailAddress(row.email))
    .filter(Boolean);

  if (contactEmails.length === 0) return [];

  const placeholders = contactEmails.map(() => '?').join(',');
  return db.prepare(`
    SELECT e.id, e.subject, e.from_address, e.to_addresses, e.date, e.is_inbound,
           e.ai_sentiment, e.ai_sentiment_confidence, e.ai_sentiment_reasoning
    FROM emails e
    WHERE LOWER(e.from_address) IN (${placeholders})
       OR EXISTS (
         SELECT 1
         FROM json_each(e.to_addresses) je
         WHERE LOWER(TRIM(je.value, '"')) IN (${placeholders})
       )
    ORDER BY e.date DESC
  `).all(...contactEmails, ...contactEmails);
}

function refreshDealSentiment(db, deal) {
  if (!deal) return deal;

  const emails = getRelatedEmailsForDeal(db, deal);
  const { sentiment } = deriveSentiment(emails);

  if (deal.sentiment !== sentiment) {
    db.prepare("UPDATE deals SET sentiment = ?, sentiment_updated_at = datetime('now') WHERE id = ?").run(sentiment, deal.id);
  } else if (!deal.sentiment_updated_at) {
    db.prepare("UPDATE deals SET sentiment_updated_at = datetime('now') WHERE id = ?").run(deal.id);
  }

  return {
    ...deal,
    sentiment,
    sentiment_updated_at: deal.sentiment !== sentiment || !deal.sentiment_updated_at
      ? new Date().toISOString()
      : deal.sentiment_updated_at,
  };
}

module.exports = { deriveSentiment, getRelatedEmailsForDeal, refreshDealSentiment };
