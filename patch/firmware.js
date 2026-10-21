// The NML-3DLS firmware image: a 0x200-byte header, the code (Thumb, linked at address 0), then the
// resources (pictures and other files). The header holds the sizes and offsets of both sections
// and a CRC-32/MPEG-2 of each.

export const HEADER_SIZE = 0x200;
const CODE_LENGTH = 0x28;
const RES_OFFSET = 0x34;
const RES_LENGTH = 0x38;
const CODE_CRC = 0x44;
const RES_CRC = 0x54;

// The bootloader wants the resources at a multiple of 0x400 and writes the image in 0x4000-byte
// blocks (a partial last block is dropped), so the image is padded to whole blocks.
const RES_ALIGN = 0x400;
export const FILE_ALIGN = 0x4000;

const view = (bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
export const u32 = (bytes, at) => view(bytes).getUint32(at, true);
export const setU32 = (bytes, at, value) => view(bytes).setUint32(at, value >>> 0, true);
const u16 = (bytes, at) => view(bytes).getUint16(at, true);
const alignUp = (n, align) => Math.ceil(n / align) * align;

// CRC-32/MPEG-2: polynomial 0x04C11DB7, initial value 0xFFFFFFFF, not reflected, no final XOR.
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n << 24;
  for (let k = 0; k < 8; k++) c = c & 0x80000000 ? (c << 1) ^ 0x04c11db7 : c << 1;
  return c >>> 0;
});

export function crc32mpeg2(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = (c << 8) ^ CRC_TABLE[((c >>> 24) ^ b) & 0xff];
  return c >>> 0;
}

export function parse(image) {
  return {
    header: image.subarray(0, HEADER_SIZE),
    code: image.subarray(HEADER_SIZE, HEADER_SIZE + u32(image, CODE_LENGTH)),
    resources: image.subarray(u32(image, RES_OFFSET)),
  };
}

// The resources begin with a table of the files they hold: a count at 0x20, then 16-byte entries
// {offset, size, ...} from 0x24. A custom boot GIF is stored right after the file that ends last,
// so that file is extended to the end of the resources, over anything appended to them.
function coverAppendedData(res) {
  const entries = Array.from({ length: u16(res, 0x20) }, (_, i) => 0x24 + 16 * i);
  const last = entries.reduce((a, b) => (u32(res, b) > u32(res, a) ? b : a));
  setU32(res, last + 4, res.length - u32(res, last));
}

// An image from the official header and new sections: the code zero-padded up to the resources,
// the resources up to a whole number of blocks, and the header updated.
export function build(header, code, resources) {
  const resOffset = alignUp(HEADER_SIZE + code.length, RES_ALIGN);
  const image = new Uint8Array(alignUp(resOffset + resources.length, FILE_ALIGN));
  image.set(header);
  image.set(code, HEADER_SIZE);
  image.set(resources, resOffset);
  const res = image.subarray(resOffset);
  coverAppendedData(res);
  setU32(image, CODE_LENGTH, resOffset - HEADER_SIZE);
  setU32(image, RES_OFFSET, resOffset);
  setU32(image, RES_LENGTH, res.length);
  setU32(image, CODE_CRC, crc32mpeg2(image.subarray(HEADER_SIZE, resOffset)));
  setU32(image, RES_CRC, crc32mpeg2(res));
  return image;
}
