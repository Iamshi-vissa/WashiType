// Receives error reports from visitors' browsers and writes them to the Vercel logs, so
// errors that show the TV are visible to the site owner: Vercel dashboard > washi-type >
// Logs, search for "client-error".
//
// Only short, plain text is kept: no cookies, no IP addresses, nothing personal.

const MAX_PER_MINUTE = 60; // per server instance, to keep a broken client from flooding the logs
let windowStart = 0;
let count = 0;

// Control characters (line breaks, escape codes) become spaces so one report is one log line.
const clean = (value, max) =>
  [...String(value ?? '')]
    .map(ch => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? ' ' : ch))
    .join('')
    .slice(0, max);

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'POST only' });
    return;
  }
  const now = Date.now();
  if (now - windowStart > 60000) {
    windowStart = now;
    count = 0;
  }
  if (++count > MAX_PER_MINUTE) {
    res.status(429).end();
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  if (!body || typeof body !== 'object') body = {};

  // Nothing worth logging (empty or malformed body).
  if (!body.kind && !body.message) {
    res.status(204).end();
    return;
  }

  const report = {
    kind: clean(body.kind, 40),
    message: clean(body.message, 500),
    stack: clean(body.stack, 2000),
    page: clean(body.page, 200),
    release: clean(body.release, 40),
    browser: clean(req.headers['user-agent'], 200)
  };
  console.error(`[client-error] ${JSON.stringify(report)}`);
  res.status(204).end();
}
