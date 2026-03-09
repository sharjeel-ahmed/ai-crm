const { google } = require('googleapis');
const { getDb } = require('../../db/connection');
const { getOAuth2Client, refreshAccessToken } = require('./oauth');

async function getGmailClient(account) {
  const oauth2Client = getOAuth2Client();

  // Check if token needs refresh
  const now = Date.now();
  if (account.token_expires_at && now >= account.token_expires_at - 60000) {
    try {
      const newTokens = await refreshAccessToken(account.refresh_token);
      const db = getDb();
      db.prepare(
        "UPDATE email_accounts SET access_token = ?, token_expires_at = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(newTokens.access_token, newTokens.expiry_date || null, account.id);
      account.access_token = newTokens.access_token;
    } catch (err) {
      console.error(`Token refresh failed for account ${account.id}:`, err.message);
      throw err;
    }
  }

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

function decodeBase64Url(str) {
  if (!str) return '';
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function extractBody(payload) {
  // Simple text body
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Multipart — find text/plain part
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      // Nested multipart
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
    // Fallback to text/html if no text/plain
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = decodeBase64Url(part.body.data);
        return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }
  }

  return '';
}

function getHeader(headers, name) {
  const header = headers?.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || '';
}

function parseFromAddress(from) {
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].replace(/"/g, '').trim(), address: match[2].trim() };
  }
  return { name: '', address: from.trim() };
}

async function syncEmails(account) {
  const gmail = await getGmailClient(account);
  const db = getDb();

  // Always fetch last 3 days to catch any emails missed in previous syncs
  const query = 'newer_than:5d';

  let synced = 0;

  try {
    // Paginate through all matching emails
    let messages = [];
    let pageToken = null;
    do {
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 100,
        pageToken: pageToken || undefined,
      });
      messages = messages.concat(listResponse.data.messages || []);
      pageToken = listResponse.data.nextPageToken;
    } while (pageToken && messages.length < 500); // safety cap at 500

    for (const msg of messages) {
      // Skip if already synced
      const existing = db.prepare('SELECT id FROM emails WHERE gmail_message_id = ?').get(msg.id);
      if (existing) continue;

      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        });

        const headers = detail.data.payload?.headers || [];
        const subject = getHeader(headers, 'Subject');
        const from = getHeader(headers, 'From');
        const to = getHeader(headers, 'To');
        const date = getHeader(headers, 'Date');
        const { name: fromName, address: fromAddress } = parseFromAddress(from);
        const bodyText = extractBody(detail.data.payload).substring(0, 10000); // Limit body size
        const isInbound = !fromAddress.toLowerCase().includes(account.email_address.toLowerCase()) ? 1 : 0;

        db.prepare(
          'INSERT INTO emails (email_account_id, gmail_message_id, gmail_thread_id, subject, from_address, from_name, to_addresses, body_text, date, is_inbound) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          account.id, msg.id, msg.threadId, subject, fromAddress, fromName,
          JSON.stringify(to.split(',').map(s => s.trim())),
          bodyText, date, isInbound
        );

        synced++;
      } catch (err) {
        console.error(`Failed to sync message ${msg.id}:`, err.message);
      }
    }

    // Update last sync time
    db.prepare("UPDATE email_accounts SET last_sync_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(account.id);

  } catch (err) {
    console.error(`Gmail sync error for account ${account.id}:`, err.message);
    throw err;
  }

  return synced;
}

module.exports = { syncEmails };
