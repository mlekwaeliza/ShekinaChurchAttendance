'use strict';

const express = require('express');
const { subscribe } = require('./bus');

const router = express.Router();

// Server-Sent Events stream for the authenticated user.
// Clients connect with: new EventSource('/api/events', { withCredentials: true })
// The browser sends cookies automatically; session middleware runs before
// us, so req.session.userId is available.
router.get('/', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Disable proxy buffering (Nginx/Render)
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Send a hello immediately so the client knows the stream is live
  res.write(`event: hello\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);

  const unsub = subscribe(req.session.userId, res);

  req.on('close', () => {
    unsub();
    try { res.end(); } catch (_) { /* already ended */ }
  });
});

module.exports = router;
