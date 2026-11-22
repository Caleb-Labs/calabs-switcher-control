import { slotPixels, slotNames } from '../shared/split.js';

export const MOLD_W = 1920;
export const MOLD_H = 1080;

// Dibuja el "molde" de una cantidad de cámaras: una guía 1920x1080 con cada recuadro, su nombre y sus medidas en píxeles,
// para mandarla a quien diseña los fondos. `ctx` es un CanvasRenderingContext2D (o uno de prueba).
export function drawMold(ctx, count, slots, names = slotNames(count)) {
  ctx.fillStyle = '#1b1e24';
  ctx.fillRect(0, 0, MOLD_W, MOLD_H);
  ctx.strokeStyle = '#2b2f37';
  ctx.lineWidth = 1;
  for (let x = 0; x <= MOLD_W; x += 120) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MOLD_H); ctx.stroke(); }
  for (let y = 0; y <= MOLD_H; y += 120) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MOLD_W, y); ctx.stroke(); }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#cfd3da';
  ctx.font = '600 30px sans-serif';
  ctx.fillText(`Molde · ${count} ${count === 1 ? 'cámara' : 'cámaras'} · ${MOLD_W} × ${MOLD_H} px`, 16, 8);

  slotPixels(slots).forEach((p, i) => {
    ctx.fillStyle = 'rgba(111,143,176,0.35)';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = '#6f8fb0';
    ctx.lineWidth = 4;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 56px sans-serif';
    ctx.fillText(`${i + 1} · ${names[i] ?? ''}`, cx, cy - 44);
    ctx.font = '500 44px sans-serif';
    ctx.fillText(`${p.w} × ${p.h} px`, cx, cy + 20);
    ctx.fillStyle = '#aeb4bf';
    ctx.font = '400 32px sans-serif';
    ctx.fillText(`X ${p.x}  ·  Y ${p.y}`, cx, cy + 72);
  });
}

// Descarga el molde como PNG (solo navegador).
export function downloadMold(count, slots) {
  const canvas = document.createElement('canvas');
  canvas.width = MOLD_W;
  canvas.height = MOLD_H;
  drawMold(canvas.getContext('2d'), count, slots);
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `molde-${count}-${count === 1 ? 'camara' : 'camaras'}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}

// Guía para diseñar la plantilla de un GC (PNG con transparencia): 1240 x 240 px = el GC de 620 x 120 al doble de nitidez.
export function drawGcMold(ctx, w = 1240, h = 240) {
  ctx.fillStyle = '#1b1e24'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#6f8fb0'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, w - 4, h - 4);
  ctx.setLineDash?.([12, 10]); ctx.strokeStyle = '#aeb4bf'; ctx.lineWidth = 2;
  ctx.strokeRect(w * 0.04, h * 0.14, w * 0.92, h * 0.72); // zona segura del texto
  ctx.setLineDash?.([]);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
  ctx.font = '600 44px sans-serif'; ctx.fillText(`Plantilla de GC · ${w} × ${h} px`, w / 2, h * 0.4);
  ctx.font = '400 30px sans-serif'; ctx.fillStyle = '#aeb4bf';
  ctx.fillText('Se muestra a 620 × 120 px (tamaño 1). El texto va dentro del recuadro punteado.', w / 2, h * 0.64);
}
export function downloadGcMold() {
  const c = document.createElement('canvas'); c.width = 1240; c.height = 240;
  drawGcMold(c.getContext('2d'));
  c.toBlob((blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'molde-plantilla-gc-1240x240.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }, 'image/png');
}
