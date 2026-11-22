import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createState, reduce, persistable } from '../server/state.js';
import { DEFAULT_STYLE, IN_EFFECTS, OUT_EFFECTS, patchStyle, styleVars, hexToRgba } from '../public/shared/gcstyle.js';
import { syncGraphics, OUT_MS } from '../public/graphics/layer.js';
import { createAutoHide } from '../server/autohide.js';

const team = (i) => ({ name: `Equipo ${i}`, players: ['a', 'b'], source: { kind: 'vdo', room: `sala${i}` } });
const config = { teams: Array.from({ length: 8 }, (_, i) => team(i + 1)) };
const S = (c = config) => createState(c);
const apply = (s, ...a) => a.reduce(reduce, s);

// ---------- estilo (funciones puras) ----------
test('patchStyle valida cada campo y devuelve null si alguno es inválido', () => {
  const ok = patchStyle(DEFAULT_STYLE, { bg: '#112233', bgAlpha: 0.5, scale: 1.5, effectIn: 'zoom', effectOut: 'slide-down', autoHide: 8, text: '#FFFFFF', sub: '#aaaaaa', accent: '#ff0000' });
  assert.deepEqual({ bg: ok.bg, a: ok.bgAlpha, s: ok.scale, i: ok.effectIn, o: ok.effectOut, h: ok.autoHide }, { bg: '#112233', a: 0.5, s: 1.5, i: 'zoom', o: 'slide-down', h: 8 });
  for (const bad of [{ bg: 'rojo' }, { bg: '#12345' }, { bgAlpha: 2 }, { bgAlpha: 'x' }, { scale: 0 }, { scale: 99 }, { effectIn: 'explotar' }, { effectOut: 'slide-up' }, { autoHide: -1 }, { autoHide: 9999 }, { autoHide: 1.5 }, { nope: 1 }]) {
    assert.equal(patchStyle(DEFAULT_STYLE, bad), null, JSON.stringify(bad));
  }
  assert.ok(IN_EFFECTS.includes('typewriter') && OUT_EFFECTS.includes('zoom'));
});

test('styleVars entrega variables CSS con el fondo en rgba y el tamaño', () => {
  const v = styleVars({ ...DEFAULT_STYLE, bg: '#102030', bgAlpha: 0.5, scale: 1.25 });
  assert.equal(v['--gc-bg'], 'rgba(16, 32, 48, 0.5)');
  assert.equal(v['--gc-scale'], '1.25');
  assert.equal(hexToRgba('#ffffff', 1), 'rgba(255, 255, 255, 1)');
});

// ---------- estado ----------
test('GC_STYLE cambia el estilo de un tipo de GC sin tocar a los otros', () => {
  assert.deepEqual(S().gcStyle.name, DEFAULT_STYLE);
  const s = apply(S(), { type: 'GC_STYLE', target: 'split', patch: { accent: '#ff8800', scale: 0.8 } });
  assert.equal(s.gcStyle.split.accent, '#ff8800');
  assert.equal(s.gcStyle.split.scale, 0.8);
  assert.deepEqual(s.gcStyle.name, DEFAULT_STYLE);
  const s0 = S();
  for (const bad of [{ target: 'otro', patch: {} }, { target: 'toString', patch: {} }, { target: 'name', patch: { bg: 'rojo' } }, { target: 'name', patch: 'x' }, { target: 'name', patch: null }]) {
    assert.equal(apply(s0, { type: 'GC_STYLE', ...bad }), s0);
  }
});

test('la plantilla del GC debe ser una imagen ya subida; si el archivo desaparece se quita', () => {
  let s = apply(S(), { type: 'VTR_FILES', files: ['@tabla', 'plantilla.png', 'video.mp4'] });
  assert.equal(apply(s, { type: 'GC_STYLE', target: 'name', patch: { template: 'plantilla.png' } }).gcStyle.name.template, 'plantilla.png');
  assert.equal(apply(s, { type: 'GC_STYLE', target: 'name', patch: { template: 'video.mp4' } }), s);
  assert.equal(apply(s, { type: 'GC_STYLE', target: 'name', patch: { template: 'nope.png' } }), s);
  s = apply(s, { type: 'GC_STYLE', target: 'name', patch: { template: 'plantilla.png' } });
  assert.equal(apply(s, { type: 'GC_STYLE', target: 'name', patch: { template: null } }).gcStyle.name.template, null);
  assert.equal(apply(s, { type: 'VTR_FILES', files: ['@tabla'] }).gcStyle.name.template, null);
});

test('el estilo se guarda en disco y los datos corruptos vuelven a valores válidos', () => {
  const s = apply(S(), { type: 'GC_STYLE', target: 'score', patch: { bg: '#001122', autoHide: 12 } });
  const r = S({ ...config, saved: JSON.parse(JSON.stringify(persistable(s))) });
  assert.equal(r.gcStyle.score.bg, '#001122');
  assert.equal(r.gcStyle.score.autoHide, 12);
  const bad = S({ ...config, saved: { gcStyle: { name: { bg: 'rojo', scale: 99, effectIn: 'x' }, split: 5 } } });
  assert.deepEqual(bad.gcStyle.name, DEFAULT_STYLE);
  assert.deepEqual(bad.gcStyle.split, DEFAULT_STYLE);
});

// ---------- se aplica al dibujar ----------
function mount(state, which) {
  const { document } = parseHTML('<div id="c"></div>');
  global.document = document;
  const c = document.getElementById('c');
  syncGraphics(c, state, which);
  return { c, document };
}
const armed = (s) => apply(s, { type: 'GC_ARM', gcId: 'name', template: 'gc-name', data: { team: 'A', player: 'p' } }, { type: 'GC_LIVE', gcId: 'name' });

test('el GC usa sus colores, su tamaño y su efecto de entrada', () => {
  const s = armed(apply(S(), { type: 'GC_STYLE', target: 'name', patch: { bg: '#102030', bgAlpha: 0.5, text: '#ffffff', accent: '#ff0000', scale: 2, effectIn: 'slide-left' } }));
  const { c } = mount(s, 'live');
  const n = c.firstElementChild;
  assert.equal(n.style.getPropertyValue('--gc-bg'), 'rgba(16, 32, 48, 0.5)');
  assert.equal(n.style.getPropertyValue('--gc-accent'), '#ff0000');
  assert.equal(n.style.getPropertyValue('--gk'), '2');
  assert.ok(n.classList.contains('fx-in-slide-left'));
  assert.equal(n.dataset.out, 'fade');
});

test('el tamaño del GC de un recuadro combina el ajuste automático con el del estilo', () => {
  const base = apply(S(), { type: 'SPLIT_SET_CAMS', cams: ['cam1', 'cam2', 'cam3', 'cam4', 'cam5', 'cam6', 'cam7'] }, { type: 'SPLIT_GC', to: 'live' });
  const small = mount({ ...base, program: 'split', preview: 'cam1' }, 'live').c.firstElementChild.style.getPropertyValue('--gk');
  const big = mount({ ...apply(base, { type: 'GC_STYLE', target: 'split', patch: { scale: 2 } }), program: 'split', preview: 'cam1' }, 'live').c.firstElementChild.style.getPropertyValue('--gk');
  assert.ok(Math.abs(Number(big) - 2 * Number(small)) < 0.011, `${small} -> ${big}`);
});

test('una plantilla reemplaza el fondo del GC por la imagen', () => {
  let s = apply(S(), { type: 'VTR_FILES', files: ['@tabla', 'mi plantilla.png'] }, { type: 'GC_STYLE', target: 'name', patch: { template: 'mi plantilla.png' } });
  const n = mount(armed(s), 'live').c.firstElementChild;
  assert.ok(n.classList.contains('has-tpl'));
  assert.match(n.style.getPropertyValue('--gc-tpl'), /\/vtr\/mi%20plantilla\.png/);
});

test('con efecto de salida el GC no desaparece de golpe: sale animado y luego se quita', async () => {
  const live = armed(apply(S(), { type: 'GC_STYLE', target: 'name', patch: { effectOut: 'slide-right' } }));
  const { c } = mount(live, 'live');
  syncGraphics(c, apply(live, { type: 'GC_OFF', gcId: 'name' }), 'live');
  assert.equal(c.children.length, 1);
  assert.ok(c.firstElementChild.classList.contains('fx-out-slide-right'));
  assert.equal(c.firstElementChild.dataset.leaving, '1');
  await new Promise((r) => setTimeout(r, OUT_MS + 80));
  assert.equal(c.children.length, 0);
});

test('sin efecto de salida se quita al instante; si vuelve a salir mientras se va, se reemplaza por uno nuevo', async () => {
  const none = armed(apply(S(), { type: 'GC_STYLE', target: 'name', patch: { effectOut: 'none' } }));
  const a = mount(none, 'live').c;
  syncGraphics(a, apply(none, { type: 'GC_OFF', gcId: 'name' }), 'live');
  assert.equal(a.children.length, 0);
  const fade = armed(S());
  const { c } = mount(fade, 'live');
  syncGraphics(c, apply(fade, { type: 'GC_OFF', gcId: 'name' }), 'live');
  syncGraphics(c, fade, 'live');
  assert.equal(c.children.length, 1);
  assert.equal(c.firstElementChild.dataset.leaving, undefined);
  await new Promise((r) => setTimeout(r, OUT_MS + 80));
  assert.equal(c.children.length, 1); // el nuevo no lo borra el temporizador del viejo
});

// ---------- salida automática ----------
function harness() {
  const timers = []; const actions = [];
  const ah = createAutoHide({ dispatch: (a) => actions.push(a), setTimer: (fn, ms) => { const t = { fn, ms, off: false }; timers.push(t); return t; }, clearTimer: (t) => { t.off = true; } });
  return { ah, timers, actions, fire: (i) => { if (!timers[i].off) timers[i].fn(); } };
}

test('autoHide: un GC que sale al aire con segundos configurados se baja solo', () => {
  const h = harness();
  const base = apply(S(), { type: 'GC_STYLE', target: 'name', patch: { autoHide: 6 } }, { type: 'GC_ARM', gcId: 'name', template: 'gc-name', data: { team: 'A', player: '' } });
  const live = apply(base, { type: 'GC_LIVE', gcId: 'name' });
  h.ah.check(base, live);
  assert.equal(h.timers.length, 1);
  assert.equal(h.timers[0].ms, 6000);
  h.fire(0);
  assert.deepEqual(h.actions, [{ type: 'GC_OFF', gcId: 'name' }]);
});

test('autoHide: 0 = manual; bajarlo a mano cancela el temporizador; el marcador y los de la dividida también', () => {
  const h = harness();
  const base = apply(S(), { type: 'GC_ARM', gcId: 'name', template: 'gc-name', data: { team: 'A', player: '' } });
  h.ah.check(base, apply(base, { type: 'GC_LIVE', gcId: 'name' }));
  assert.equal(h.timers.length, 0);
  const withHide = apply(base, { type: 'GC_STYLE', target: 'name', patch: { autoHide: 5 } });
  const live = apply(withHide, { type: 'GC_LIVE', gcId: 'name' });
  h.ah.check(withHide, live);
  h.ah.check(live, apply(live, { type: 'GC_OFF', gcId: 'name' }));
  assert.equal(h.timers[0].off, true);

  const sp = apply(S(), { type: 'GC_STYLE', target: 'split', patch: { autoHide: 4 } }, { type: 'SPLIT_GC', to: 'live' });
  const noAir = { ...sp, program: 'cam1' };
  const onAir = { ...sp, program: 'split' };
  const h2 = harness();
  h2.ah.check(noAir, onAir); // empieza a contar cuando la dividida está al aire y los GC visibles
  assert.equal(h2.timers[0].ms, 4000);
  h2.fire(0);
  assert.deepEqual(h2.actions, [{ type: 'SPLIT_GC', to: 'off' }]);

  const h3 = harness();
  const sc = apply(S(), { type: 'GC_STYLE', target: 'score', patch: { autoHide: 9 } }, { type: 'GC_ARM', gcId: 'score', template: 'scoreboard', data: {} });
  h3.ah.check(sc, apply(sc, { type: 'GC_LIVE', gcId: 'score' }));
  assert.equal(h3.timers[0].ms, 9000);
});
