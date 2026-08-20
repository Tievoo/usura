/**
 * Genera los PNG del ícono desde el mismo dibujo que `public/icon.svg`.
 *
 *   bun run scripts/make-icons.ts
 *
 * Existe porque Chrome en Android pide un PNG de 192 y otro de 512 para ofrecer
 * la instalación del PWA; un ícono SVG solo no siempre alcanza. El dibujo son
 * rectángulos sólidos, así que se rasteriza y se codifica el PNG acá mismo en
 * vez de agregar una dependencia de imágenes al proyecto.
 *
 * Si cambia `public/icon.svg`, hay que actualizar RECTS y volver a correrlo.
 */

import { deflateSync } from 'node:zlib'

/** Mismo viewBox y mismos colores que public/icon.svg. */
const VIEWBOX = 512
const RECTS: [number, number, number, number, string][] = [
  [0, 0, 512, 512, '#141210'],
  [112, 300, 52, 100, '#5FA391'],
  [196, 216, 52, 184, '#8B8177'],
  [280, 132, 52, 268, '#DDA544'],
  [112, 416, 288, 10, '#423A32'],
  [364, 132, 36, 10, '#DDA544'],
]

const rgb = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
]

/* ---------- PNG ---------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, data.length)
  const t = new TextEncoder().encode(type)
  out.set(t, 4)
  out.set(data, 8)
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** Color type 2 (RGB, sin alfa): el ícono es opaco y así el maskable no deja huecos. */
function png(size: number): Uint8Array {
  const stride = size * 3
  // Cada scanline lleva adelante su byte de filtro, que dejamos en 0 (sin filtrar).
  const raw = new Uint8Array((stride + 1) * size)

  for (const [x, y, w, h, hex] of RECTS) {
    const [r, g, b] = rgb(hex)
    const s = size / VIEWBOX
    const x0 = Math.round(x * s), y0 = Math.round(y * s)
    const x1 = Math.round((x + w) * s), y1 = Math.round((y + h) * s)
    for (let py = y0; py < y1; py++) {
      const base = py * (stride + 1) + 1
      for (let px = x0; px < x1; px++) {
        const i = base + px * 3
        raw[i] = r; raw[i + 1] = g; raw[i + 2] = b
      }
    }
  }

  const ihdr = new Uint8Array(13)
  const dv = new DataView(ihdr.buffer)
  dv.setUint32(0, size)
  dv.setUint32(4, size)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // color type: RGB
  ihdr[10] = 0  // deflate
  ihdr[11] = 0  // filtro adaptativo
  ihdr[12] = 0  // sin entrelazado

  const partes = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array(deflateSync(raw, { level: 9 }))),
    chunk('IEND', new Uint8Array(0)),
  ]
  const total = partes.reduce((a, p) => a + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of partes) { out.set(p, o); o += p.length }
  return out
}

for (const size of [192, 512]) {
  const ruta = `public/icon-${size}.png`
  await Bun.write(ruta, png(size))
  console.log(`${ruta}  ${size}x${size}  ${(Bun.file(ruta).size / 1024).toFixed(1)} KB`)
}
