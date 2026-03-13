const { getDb } = require('../../db/connection');
const { extractFromEmail } = require('./provider');
const { checkAutoApprove } = require('./autoApprove');

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
  return values.map(normalizeEmailAddress).filter(Boolean);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getEmailTimestamp(email) {
  const parsedDate = email?.date ? new Date(email.date).getTime() : NaN;
  if (!Number.isNaN(parsedDate) && Number.isFinite(parsedDate)) return parsedDate;

  const createdAt = email?.created_at ? new Date(email.created_at).getTime() : NaN;
  if (!Number.isNaN(createdAt) && Number.isFinite(createdAt)) return createdAt;

  return 0;
}

function sortEmailsChronologically(emails) {
  return [...emails].sort((a, b) => {
    const diff = getEmailTimestamp(a) - getEmailTimestamp(b);
    if (diff !== 0) return diff;
    return a.id - b.id;
  });
}

function buildThreadQueues(emails) {
  const queues = new Map();

  for (const email of sortEmailsChronologically(emails)) {
    const key = email.gmail_thread_id || `email-${email.id}`;
    if (!queues.has(key)) queues.set(key, []);
    queues.get(key).push(email);
  }

  return [...queues.values()];
}

async function processOneEmail(email, aiSettings) {
  const db = getDb();
  try {
    const result = await extractFromEmail(email, aiSettings.provider, aiSettings.api_key, aiSettings.model);
    const { sentiment, suggestions, prompt, rawResponse } = result;

    db.prepare(`
      UPDATE emails
      SET ai_prompt = ?, ai_response = ?, ai_sentiment = ?, ai_sentiment_confidence = ?, ai_sentiment_reasoning = ?
      WHERE id = ?
    `).run(
      prompt,
      rawResponse,
      sentiment?.label || 'neutral',
      sentiment?.confidence ?? 0,
      sentiment?.reasoning || null,
      email.id
    );

    for (const suggestion of suggestions) {
      // Handle newsletter detection: auto-add to ignore list if confidence >= 85%
      if (suggestion.type === 'newsletter_detected') {
        const senderEmail = (suggestion.data?.sender_email || email.from_address || '').toLowerCase().trim();
        const newsletterStatus = suggestion.confidence >= 0.85 ? 'auto_approved' : 'pending';

        if (newsletterStatus === 'auto_approved' && senderEmail) {
          const existing = db.prepare('SELECT id FROM email_ignore_list WHERE LOWER(email_address) = ?').get(senderEmail);
          if (!existing) {
            const reason = `Newsletter auto-detected: ${suggestion.data?.newsletter_name || 'Unknown'} (${Math.round(suggestion.confidence * 100)}% confidence)`;
            db.prepare('INSERT INTO email_ignore_list (email_address, reason) VALUES (?, ?)').run(senderEmail, reason);
            console.log(`Auto-ignored newsletter sender: ${senderEmail}`);
          }
        }

        db.prepare(
          'INSERT INTO ai_suggestions (email_id, type, data, confidence, reasoning, status) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(
          email.id,
          suggestion.type,
          JSON.stringify(suggestion.data),
          suggestion.confidence,
          suggestion.reasoning,
          newsletterStatus
        );
        continue;
      }

      const result = db.prepare(
        'INSERT INTO ai_suggestions (email_id, type, data, confidence, reasoning, status) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        email.id,
        suggestion.type,
        JSON.stringify(suggestion.data),
        suggestion.confidence,
        suggestion.reasoning,
        'pending'
      );
      checkAutoApprove(result.lastInsertRowid);
    }

    db.prepare('UPDATE emails SET ai_processed = 1 WHERE id = ?').run(email.id);
    return { success: true, suggestions: suggestions.length };
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('credit balance') || msg.includes('billing') || msg.includes('authentication') || msg.includes('unauthorized')) {
      return { success: false, fatal: true, error: msg };
    }
    console.error(`AI pipeline error for email ${email.id}:`, msg);
    db.prepare('UPDATE emails SET ai_processed = 1 WHERE id = ?').run(email.id);
    return { success: false, error: msg };
  }
}

async function processUnprocessedEmails() {
  const db = getDb();

  const aiSettings = db.prepare('SELECT * FROM ai_settings WHERE is_active = 1 LIMIT 1').get();
  if (!aiSettings || (aiSettings.provider !== 'claude-cli' && !aiSettings.api_key)) {
    return { processed: 0, reason: 'No active AI provider configured' };
  }

  let totalProcessed = 0;
  let totalErrors = 0;
  const BATCH_SIZE = 5;
  const CHUNK_SIZE = 50;

  // Loop until all unprocessed emails are done
  while (true) {
    const allEmails = db.prepare('SELECT * FROM emails WHERE ai_processed = 0 LIMIT ?').all(CHUNK_SIZE);
    if (allEmails.length === 0) break;

    // Filter out ignored email addresses
    const ignoreList = db.prepare('SELECT LOWER(email_address) as email FROM email_ignore_list').all().map(r => r.email);
    const emails = [];
    for (const email of allEmails) {
      const from = normalizeEmailAddress(email.from_address);
      const toEmails = parseEmailArray(email.to_addresses);

      const isIgnored = ignoreList.some(ignored => from === ignored || toEmails.includes(ignored));
      if (isIgnored) {
        db.prepare('UPDATE emails SET ai_processed = 1 WHERE id = ?').run(email.id);
      } else {
        emails.push(email);
      }
    }

    if (emails.length === 0) continue;

    const threadQueues = buildThreadQueues(emails);
    console.log(`AI pipeline: ${emails.length} emails to process in chronological thread order (${threadQueues.length} thread groups)`);

    let processed = 0;
    let errors = 0;

    let batchNumber = 0;
    while (true) {
      const batch = [];
      for (const queue of threadQueues) {
        if (queue.length > 0) {
          batch.push(queue.shift());
        }
        if (batch.length === BATCH_SIZE) break;
      }

      if (batch.length === 0) break;

      batchNumber += 1;
      const results = await Promise.all(batch.map(email => processOneEmail(email, aiSettings)));

      for (const r of results) {
        if (r.fatal) {
          console.error(`AI pipeline stopped: ${r.error}`);
          return { processed: totalProcessed + processed, errors: totalErrors + errors + 1, stopped: true, reason: r.error };
        }
        if (r.success) processed++;
        else errors++;
      }

      console.log(`AI pipeline: batch ${batchNumber} done (${processed} processed, ${errors} errors)`);

      if (threadQueues.some((queue) => queue.length > 0)) {
        await sleep(1000);
      }
    }

    totalProcessed += processed;
    totalErrors += errors;

    console.log(`AI pipeline chunk complete: ${processed} processed, ${errors} errors`);

    // Small delay between chunks
    if (allEmails.length === CHUNK_SIZE) {
      await sleep(2000);
    }
  }

  if (totalProcessed > 0 || totalErrors > 0) {
    console.log(`AI pipeline complete: ${totalProcessed} total processed, ${totalErrors} total errors`);
  }
  return { processed: totalProcessed, errors: totalErrors };
}

module.exports = { processUnprocessedEmails };
