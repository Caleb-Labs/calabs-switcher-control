// Cliente WebSocket mínimo (RFC 6455) con solo módulos de Node: el plugin no necesita instalar nada.
// Soporta texto, ping/pong, cierre y mensajes fragmentados o de cualquier tamaño.
import http from 'node:http';
import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function frame(opcode, payload) {
  const len = payload.length;
  const head = len < 126 ? Buffer.alloc(2) : len < 65536 ? Buffer.alloc(4) : Buffer.alloc(10);
  head[0] = 0x80 | opcode;
  if (len < 126) head[1] = 0x80 | len;
  else if (len < 65536) { head[1] = 0x80 | 126; head.writeUInt16BE(len, 2); }
  else { head[1] = 0x80 | 127; head.writeBigUInt64BE(BigInt(len), 2); }
  const mask = crypto.randomBytes(4);
  const body = Buffer.from(payload);
  for (let i = 0; i < body.length; i++) body[i] ^= mask[i & 3];
  return Buffer.concat([head, mask, body]);
}

export function connectWS(url, { onMessage = () => {}, onClose = () => {}, onError = () => {} } = {}) {
  const u = new URL(url);
  const key = crypto.randomBytes(16).toString('base64');
  let socket = null;
  let closed = false;
  let buf = Buffer.alloc(0);
  let frag = null;

  const finish = () => { if (!closed) { closed = true; onClose(); } };

  const handle = (fin, op, payload) => {
    if (op === 0x8) { if (socket && !socket.destroyed) socket.write(frame(0x8, payload.subarray(0, 2))); socket?.end(); finish(); return; }
    if (op === 0x9) { socket.write(frame(0xa, payload)); return; }
    if (op === 0xa) return;
    if (op === 0x1 || op === 0x2) frag = { op, parts: [] };
    else if (op !== 0x0 || !frag) return;
    frag.parts.push(payload);
    if (!fin) return;
    const whole = Buffer.concat(frag.parts);
    const isText = frag.op === 0x1;
    frag = null;
    if (isText) onMessage(whole.toString('utf8'));
  };

  const feed = (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = (buf[0] & 0x80) !== 0;
      const op = buf[0] & 0x0f;
      const masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f;
      let off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      const maskLen = masked ? 4 : 0;
      if (buf.length < off + maskLen + len) return;
      const payload = Buffer.from(buf.subarray(off + maskLen, off + maskLen + len));
      if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= buf[off + (i & 3)];
      buf = buf.subarray(off + maskLen + len);
      handle(fin, op, payload);
    }
  };

  const ready = new Promise((resolve, reject) => {
    const req = http.request({
      host: u.hostname, port: u.port || 80, path: u.pathname + u.search,
      headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Key': key, 'Sec-WebSocket-Version': '13' },
    });
    req.on('upgrade', (res, sock, head) => {
      const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
      if (res.headers['sec-websocket-accept'] !== accept) { sock.destroy(); reject(new Error('handshake de WebSocket inválido')); return; }
      socket = sock;
      sock.on('data', feed);
      sock.on('close', finish);
      sock.on('error', (e) => { onError(e); finish(); });
      if (head.length) feed(head);
      resolve();
    });
    req.on('response', (res) => { res.resume(); reject(new Error(`el servidor no aceptó el WebSocket (${res.statusCode})`)); });
    req.on('error', (e) => { onError(e); reject(e); });
    req.end();
  });
  ready.catch(() => {});

  return {
    ready,
    send(text) { if (socket && !closed) socket.write(frame(0x1, Buffer.from(String(text), 'utf8'))); },
    close() { if (socket && !closed) { socket.write(frame(0x8, Buffer.alloc(0))); socket.end(); } },
  };
}
