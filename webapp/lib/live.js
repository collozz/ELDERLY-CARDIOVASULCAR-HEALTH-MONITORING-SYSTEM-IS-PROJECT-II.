// Live updates to open dashboards using Server-Sent Events.
// Each browser only receives events about elderly people it is allowed to see.

const { visibleElderlyIds } = require('./auth');

const clients = new Set();
let status = { mqttConnected: false, deviceLive: false, simulateOnly: false };

async function connect(req, res) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const client = { res, elderlyIds: await visibleElderlyIds(req.session.user) };
  clients.add(client);
  res.write(`event: status\ndata: ${JSON.stringify(status)}\n\n`);
  req.on('close', () => clients.delete(client));
}

// Send an event about one elderly person to everyone allowed to see them
function send(event, data, elderlyId) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) {
    if (c.elderlyIds.includes(Number(elderlyId))) c.res.write(msg);
  }
}

function setStatus(next) {
  status = { ...status, ...next };
  const msg = `event: status\ndata: ${JSON.stringify(status)}\n\n`;
  for (const c of clients) c.res.write(msg);
}

module.exports = { connect, send, setStatus, getStatus: () => status };
