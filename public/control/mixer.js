import { vtrAudioStatus } from '/shared/vtr.js';

// Mezclador de audio: un fader por cámara (con encendido), nivel general de cámaras y VTR. El audio sale por /program (OBS).
export function initMixer({ send }) {
  const box = document.getElementById('mix-rows');
  document.getElementById('mix-tone').onclick = () => send({ type: 'TEST_TONE' });
  const rows = new Map(); // id -> { check, range, pct }
  let builtKey = null;
  const sendSoon = (() => { let t = 0; return (fn) => { const now = Date.now(); if (now - t > 60) { t = now; fn(); } }; })();

  function row(label, { onToggle, onLevel, onMute }) {
    const el = document.createElement('div'); el.className = 'mix-row';
    const check = document.createElement('input'); check.type = 'checkbox'; check.title = 'Audio encendido';
    if (onToggle) check.onchange = () => { onToggle(); check.blur(); }; else check.hidden = true;
    const name = document.createElement('span'); name.className = 'mix-name'; name.textContent = label;
    const range = document.createElement('input'); range.type = 'range'; range.min = 0; range.max = 100; range.step = 1;
    const pct = document.createElement('span'); pct.className = 'mix-pct';
    range.oninput = () => { pct.textContent = `${range.value}%`; sendSoon(() => onLevel(Number(range.value) / 100)); };
    range.onchange = () => { onLevel(Number(range.value) / 100); range.blur(); };
    el.append(check, name, range, pct);
    if (onMute) { const m = document.createElement('button'); m.textContent = 'mute'; m.onclick = () => { onMute(); m.blur(); }; el.append(m); }
    box.append(el);
    return { el, check, range, pct };
  }

  function build(state) {
    box.replaceChildren();
    rows.clear();
    rows.set('@cam', row('Cámaras (general)', { onLevel: (l) => send({ type: 'SET_VOLUME', target: 'cam', level: l }), onMute: () => send({ type: 'TOGGLE_MUTE', target: 'cam' }) }));
    for (const s of state.sources.filter((x) => x.kind !== 'vtr' && x.kind !== 'split')) {
      rows.set(s.id, row(s.label, { onToggle: () => send({ type: 'MIX_TOGGLE', id: s.id }), onLevel: (l) => send({ type: 'MIX_LEVEL', id: s.id, level: l }) }));
    }
    rows.set('@vtr', row('VTR', { onLevel: (l) => send({ type: 'SET_VOLUME', target: 'vtr', level: l }), onMute: () => send({ type: 'TOGGLE_MUTE', target: 'vtr' }) }));
    const st = document.createElement('div'); st.id = 'mix-vtr-status'; st.className = 'vtr-status'; box.append(st);
  }

  const setRange = (r, level) => { if (document.activeElement !== r.range) { r.range.value = Math.round(level * 100); r.pct.textContent = `${r.range.value}%`; } };

  return {
    render(state) {
      const key = JSON.stringify(state.sources.map((s) => s.id + s.label));
      if (key !== builtKey) { builtKey = key; build(state); }
      setRange(rows.get('@cam'), state.audio.cam.level);
      rows.get('@cam').el.classList.toggle('muted', state.audio.cam.muted);
      for (const [id, m] of Object.entries(state.mix)) {
        const r = rows.get(id);
        if (!r) continue;
        r.check.checked = m.on || state.audioMaster === id;
        r.el.classList.toggle('master', state.audioMaster === id);
        r.el.classList.toggle('sel', state.mixSel === id);
        setRange(r, m.level);
      }
      setRange(rows.get('@vtr'), state.audio.vtr.level);
      rows.get('@vtr').el.classList.toggle('muted', state.audio.vtr.muted);
      const s = vtrAudioStatus(state);
      for (const el of [document.getElementById('mix-vtr-status'), document.getElementById('vtr-audio')]) {
        if (!el) continue;
        el.textContent = `VTR: ${s.text}`;
        el.classList.toggle('live', s.live);
      }
    },
  };
}
