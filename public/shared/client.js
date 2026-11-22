// Cliente WebSocket con reconexión automática. El servidor manda el estado al conectar.
export function connect(onState, { url = `ws://${location.host}/ws`, onStatus = () => {} } = {}) {
  let ws;
  let closed = false;
  const open = () => {
    ws = new WebSocket(url);
    ws.onopen = () => onStatus(true);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'state') onState(msg.state);
      } catch { /* mensaje inválido: se ignora */ }
    };
    ws.onclose = () => {
      onStatus(false);
      if (!closed) setTimeout(open, 1000);
    };
  };
  open();
  return {
    send: (action) => { if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'action', action })); },
    close: () => { closed = true; ws?.close(); },
  };
}
