const { getDb } = require('../../db/connection');
const { syncEmails } = require('./sync');
const { processUnprocessedEmails } = require('../ai/pipeline');

let intervalId = null;

function startWorker(intervalMs = 43200000) { // 12 hours default
  if (intervalId) {
    console.log('Email worker already running');
    return;
  }

  console.log(`Email worker started (interval: ${intervalMs / 1000}s)`);

  async function runCycle() {
    try {
      const db = getDb();
      const accounts = db.prepare('SELECT * FROM email_accounts WHERE sync_enabled = 1').all();

      for (const account of accounts) {
        try {
          const synced = await syncEmails(account);
          if (synced > 0) {
            console.log(`Synced ${synced} emails for ${account.email_address}`);
          }
        } catch (err) {
          console.error(`Sync failed for ${account.email_address}:`, err.message);
        }
      }

      // Process emails through AI pipeline
      const aiResult = await processUnprocessedEmails();
      if (aiResult.processed > 0) {
        console.log(`AI processed ${aiResult.processed} emails`);
      }
    } catch (err) {
      console.error('Worker cycle error:', err.message);
    }
  }

  // Run immediately, then on interval
  runCycle();
  intervalId = setInterval(runCycle, intervalMs);
}

function stopWorker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('Email worker stopped');
  }
}

module.exports = { startWorker, stopWorker };
