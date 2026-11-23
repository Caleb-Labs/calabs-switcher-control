import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { renderStingerList, cutValue, initStingerPanel } from '../public/control/stingerpanel.js';

const page = () => {
  const { document } = parseHTML(`<div id="trans-panel">
    <div id="st-list"></div><button id="st-add"></button><input id="st-file" type="file">
    <div id="st-editor" hidden><video id="st-video"></video><input id="st-range" type="range"><button id="st-mark"></button><input id="st-num" type="number"></div>
  </div>`);
  globalThis.document = document;
  return document;
};
const st = (extra = {}) => ({ stingers: [{ file: 'a.webm', cutAt: 5 }, { file: '<b>x.webm', cutAt: 0 }], stingerSelected: 'a.webm', stingerRun: null, ...extra });

test('lista vacía: muestra el texto de ayuda con el aviso de formato', () => {
  const { document } = parseHTML('<div id="l"></div>');
  const el = document.getElementById('l');
  renderStingerList(el, { stingers: [], stingerSelected: null });
  assert.match(el.textContent, /WebM con transparencia/);
  assert.equal(el.querySelectorAll('[data-file]').length, 0);
});

test('lista: una fila por transición, la elegida marcada, nombres como texto (no HTML)', () => {
  const { document } = parseHTML('<div id="l"></div>');
  const el = document.getElementById('l');
  renderStingerList(el, st());
  const rows = [...el.querySelectorAll('.st-row')];
  assert.equal(rows.length, 2);
  assert.ok(rows[0].classList.contains('on'));
  assert.ok(!rows[1].classList.contains('on'));
  assert.equal(rows[1].querySelector('[data-act="select"]').textContent.includes('<b>x.webm'), true);
  assert.equal(el.querySelectorAll('b').length, 0, 'el nombre no se interpreta como HTML');
  assert.equal(rows[0].querySelector('[data-act="remove"]').dataset.file, 'a.webm');
});

test('cutValue redondea a 2 decimales y nunca devuelve negativos ni NaN', () => {
  assert.equal(cutValue({ currentTime: 5.2349 }), 5.23);
  assert.equal(cutValue({ currentTime: -2 }), 0);
  assert.equal(cutValue({ currentTime: NaN }), 0);
});

test('el panel manda las acciones: elegir, quitar, cortar aquí y número editable', () => {
  const d = page();
  const sent = [];
  const panel = initStingerPanel({ send: (a) => sent.push(a) });
  panel.render(st());
  d.querySelector('[data-act="select"][data-file="<b>x.webm"]').click();
  d.querySelector('[data-act="remove"][data-file="a.webm"]').click();
  d.getElementById('st-video').currentTime = 3.456;
  d.getElementById('st-mark').click();
  const num = d.getElementById('st-num');
  num.value = '7.5';
  num.dispatchEvent(new d.defaultView.Event('change'));
  assert.deepEqual(sent, [
    { type: 'STINGER_SELECT', file: '<b>x.webm' },
    { type: 'STINGER_REMOVE', file: 'a.webm' },
    { type: 'STINGER_CUT', file: 'a.webm', at: 3.46 },
    { type: 'STINGER_CUT', file: 'a.webm', at: 7.5 },
  ]);
});

test('render repetido no recrea el video del editor (no se pierde la posición mientras se arrastra la barra)', () => {
  const d = page();
  const panel = initStingerPanel({ send: () => {} });
  panel.render(st());
  const v = d.getElementById('st-video');
  assert.equal(v.getAttribute('src') ?? v.src, '/vtr/a.webm');
  v.currentTime = 2;
  panel.render(st({ stingers: [{ file: 'a.webm', cutAt: 6 }, { file: '<b>x.webm', cutAt: 0 }] }));
  assert.equal(d.getElementById('st-video'), v);
  assert.equal(v.currentTime, 2);
  assert.equal(d.getElementById('st-num').value, '6');
  assert.equal(d.getElementById('st-editor').hidden, false);
  panel.render(st({ stingers: [], stingerSelected: null }));
  assert.equal(d.getElementById('st-editor').hidden, true);
});
