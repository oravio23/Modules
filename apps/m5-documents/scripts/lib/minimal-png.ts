/**
 * Hand-rolled minimal PNG writer — no canvas/sharp dependency.
 *
 * Produces a genuinely valid, structurally-correct PNG (correct chunk CRCs,
 * zlib-compressed IDAT via Node's built-in zlib) at a solid color. This is a
 * fixture for exercising the ingest pipeline's image-detection and
 * resize/re-encode path, not a rendered document image — real photographed
 * or scanned invoices are supplied by the user or produced by the eval
 * harness against actual uploads, not by this generator.
 */
import { deflateSync } from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

export function buildMinimalPng(width: number, height: number, rgb: [number, number, number] = [235, 235, 240]): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = chunk("IHDR", ihdrData);

  const rowBytes = width * 3;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (rowBytes + 1);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 3;
      raw[px] = rgb[0];
      raw[px + 1] = rgb[1];
      raw[px + 2] = rgb[2];
    }
  }
  const idat = chunk("IDAT", deflateSync(raw));
  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}
