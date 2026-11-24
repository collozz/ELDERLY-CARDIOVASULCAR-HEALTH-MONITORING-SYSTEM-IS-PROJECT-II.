// Live updates

const { visibleElderlyIds } = require('./auth');

const clients = new Set();
let status = { mqttConnected: false, deviceLive: false, simulateOnly: false };

async function connect(req, res) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  const client = { res, elderlyIds: await visibleElderlyIds(req.session.user) };
  clients.add(client);
  res.write(statusMsg(client));
  req.on('close', () => clients.delete(client));
}

// Send an update
function send(event, data, elderlyId) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) {
    if (c.elderlyIds.includes(Number(elderlyId))) c.res.write(msg);
  }
}

// Only show who gets the ESP32 to people assigned to them
function statusMsg(c) {
  const { liveElderlyId, liveName, ...rest } = status;
  const data = c.elderlyIds.includes(Number(liveElderlyId)) ? { ...rest, liveName } : rest;
  return `event: status\ndata: ${JSON.stringify(data)}\n\n`;
}

function setStatus(next) {
  status = { ...status, ...next };
  for (const c of clients) c.res.write(statusMsg(c));
}

module.exports = { connect, send, setStatus, getStatus: () => status };
