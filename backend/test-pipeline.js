const { processUnprocessedEmails } = require('./src/services/ai/pipeline');

processUnprocessedEmails().then(r => {
  console.log('Result:', JSON.stringify(r));
  const { getDb } = require('./src/db/connection');
  const db = getDb();
  console.log('Suggestions created:', db.prepare('SELECT COUNT(*) as c FROM ai_suggestions').get().c);
  const samples = db.prepare('SELECT s.type, s.confidence, s.reasoning, e.subject FROM ai_suggestions s JOIN emails e ON s.email_id = e.id LIMIT 10').all();
  samples.forEach(s => {
    console.log('[' + s.type + '] ' + Math.round(s.confidence * 100) + '% - ' + (s.reasoning || '').substring(0, 100) + ' | ' + (s.subject || '').substring(0, 50));
  });
}).catch(e => console.error('Error:', e.message));
