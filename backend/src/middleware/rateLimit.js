const limits = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = parseInt(process.env.API_RATE_LIMIT) || 100;

function rateLimit(req, res, next) {
  const key = req.headers['x-api-key'] || req.ip;
  const now = Date.now();

  let entry = limits.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    limits.set(key, entry);
  }

  entry.count++;

  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - entry.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

  if (entry.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
  }

  next();
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of limits) {
    if (now > entry.resetAt) limits.delete(key);
  }
}, 5 * 60 * 1000).unref();

module.exports = { rateLimit };
