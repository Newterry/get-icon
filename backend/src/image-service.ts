import sharp from 'sharp';
import { MemoryCache } from './cache.js';
import { Semaphore } from './concurrency.js';
import { AppError } from './errors.js';
import { secureGet } from './http.js';
import { inspectImage, type ImageMetadata } from './image-metadata.js';
import { normalizeWebsiteUrl } from './security.js';

const IMAGE_LIMIT = 8 * 1024 * 1024;
const IMAGE_CACHE_TTL_MS = 60 * 60 * 1000;
const rawCache = new MemoryCache<VerifiedImage>(IMAGE_CACHE_TTL_MS, 64);
const transformedCache = new MemoryCache<ServedImage>(IMAGE_CACHE_TTL_MS, 128);
const rawInFlight = new Map<string, Promise<VerifiedImage>>();
const transformInFlight = new Map<string, Promise<ServedImage>>();
const transforms = new Semaphore(4);

sharp.cache({ files: 0, items: 64, memory: 48 });
sharp.concurrency(2);

export type OutputFormat = 'original' | 'png' | 'webp' | 'jpeg' | 'avif';

export interface TransformOptions {
  format: OutputFormat;
  size: number | null;
}

export interface VerifiedImage {
  url: string;
  body: Buffer;
  metadata: ImageMetadata;
}

export interface ServedImage {
  url: string;
  body: Buffer;
  type: string;
  format: string;
}

const MIME_BY_FORMAT: Record<Exclude<OutputFormat, 'original'>, string> = {
  png: 'image/png',
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  avif: 'image/avif',
};

export function parseTransformOptions(formatValue: unknown, sizeValue: unknown): TransformOptions {
  const format = typeof formatValue === 'string' && formatValue.length > 0
    ? formatValue.toLowerCase()
    : 'original';
  if (!['original', 'png', 'webp', 'jpeg', 'avif'].includes(format)) {
    throw new AppError('INVALID_FORMAT', '不支持该输出格式，可用格式为 original、png、webp、jpeg、avif。');
  }

  let size: number | null = null;
  if (typeof sizeValue === 'string' && sizeValue.length > 0 && sizeValue !== 'original') {
    const parsed = Number(sizeValue);
    if (!Number.isInteger(parsed) || parsed < 16 || parsed > 1024) {
      throw new AppError('INVALID_SIZE', '输出尺寸必须是 16 到 1024 之间的整数。');
    }
    size = parsed;
  }
  return { format: format as OutputFormat, size };
}

async function fetchImageUncached(url: URL): Promise<VerifiedImage> {
  const result = await secureGet(url, {
    maxBytes: IMAGE_LIMIT,
    timeoutMs: 10_000,
    accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.2',
  });
  if (result.status < 200 || result.status >= 300) {
    throw new AppError('HTTP_ERROR', `图标资源返回 HTTP ${result.status}。`, 502);
  }
  const metadata = await inspectImage(result.body, result.headers['content-type']);
  if (!metadata) throw new AppError('NOT_IMAGE', '目标资源不是受支持的图片。', 415);
  return { url: result.url, body: result.body, metadata };
}

export async function fetchVerifiedImage(input: string): Promise<VerifiedImage> {
  const normalized = normalizeWebsiteUrl(input);
  const key = normalized.href;
  const cached = rawCache.get(key);
  if (cached) return cached;
  const pending = rawInFlight.get(key);
  if (pending) return pending;

  const promise = fetchImageUncached(normalized)
    .then((image) => {
      rawCache.set(key, image);
      if (image.url !== key) rawCache.set(image.url, image);
      return image;
    })
    .finally(() => rawInFlight.delete(key));
  rawInFlight.set(key, promise);
  return promise;
}

export interface DecodedIcoFrame {
  data: Buffer;
  width: number;
  height: number;
  encoded: boolean;
}

function decodeDibFrame(body: Buffer, offset: number, size: number): DecodedIcoFrame | null {
  if (offset + size > body.length || size < 40) return null;
  const headerSize = body.readUInt32LE(offset);
  if (headerSize < 40 || offset + headerSize > body.length) return null;
  const width = Math.abs(body.readInt32LE(offset + 4));
  const storedHeight = body.readInt32LE(offset + 8);
  const height = Math.floor(Math.abs(storedHeight) / 2);
  const bitsPerPixel = body.readUInt16LE(offset + 14);
  const compression = body.readUInt32LE(offset + 16);
  if (width < 1 || height < 1 || width > 1024 || height > 1024 || compression !== 0 || ![1, 4, 8, 24, 32].includes(bitsPerPixel)) {
    return null;
  }

  const declaredColors = body.readUInt32LE(offset + 32);
  const paletteCount = bitsPerPixel <= 8 ? (declaredColors || (1 << bitsPerPixel)) : 0;
  const paletteOffset = offset + headerSize;
  const pixelOffset = paletteOffset + paletteCount * 4;
  const colorStride = Math.ceil((width * bitsPerPixel) / 32) * 4;
  const maskStride = Math.ceil(width / 32) * 4;
  const maskOffset = pixelOffset + colorStride * height;
  if (pixelOffset > offset + size || maskOffset > offset + size) return null;

  const output = Buffer.alloc(width * height * 4);
  let hasAlpha = false;
  const topDown = storedHeight < 0;
  for (let y = 0; y < height; y += 1) {
    const sourceY = topDown ? y : height - 1 - y;
    const rowOffset = pixelOffset + sourceY * colorStride;
    for (let x = 0; x < width; x += 1) {
      const target = (y * width + x) * 4;
      let blue = 0;
      let green = 0;
      let red = 0;
      let alpha = 255;
      if (bitsPerPixel === 32) {
        const source = rowOffset + x * 4;
        blue = body[source] ?? 0;
        green = body[source + 1] ?? 0;
        red = body[source + 2] ?? 0;
        alpha = body[source + 3] ?? 0;
        hasAlpha ||= alpha !== 0;
      } else if (bitsPerPixel === 24) {
        const source = rowOffset + x * 3;
        blue = body[source] ?? 0;
        green = body[source + 1] ?? 0;
        red = body[source + 2] ?? 0;
      } else {
        const byte = body[rowOffset + Math.floor((x * bitsPerPixel) / 8)] ?? 0;
        const paletteIndex = bitsPerPixel === 8
          ? byte
          : bitsPerPixel === 4
            ? (x % 2 === 0 ? byte >> 4 : byte & 0x0f)
            : (byte >> (7 - (x % 8))) & 1;
        const paletteEntry = paletteOffset + paletteIndex * 4;
        if (paletteEntry + 4 > pixelOffset) return null;
        blue = body[paletteEntry] ?? 0;
        green = body[paletteEntry + 1] ?? 0;
        red = body[paletteEntry + 2] ?? 0;
      }
      output[target] = red;
      output[target + 1] = green;
      output[target + 2] = blue;
      output[target + 3] = alpha;
    }
  }

  if (bitsPerPixel === 32 && !hasAlpha) {
    for (let index = 3; index < output.length; index += 4) output[index] = 255;
  }
  if (maskOffset + maskStride * height <= offset + size) {
    for (let y = 0; y < height; y += 1) {
      const sourceY = topDown ? y : height - 1 - y;
      const rowOffset = maskOffset + sourceY * maskStride;
      for (let x = 0; x < width; x += 1) {
        const maskByte = body[rowOffset + Math.floor(x / 8)] ?? 0;
        if (((maskByte >> (7 - (x % 8))) & 1) === 1) output[(y * width + x) * 4 + 3] = 0;
      }
    }
  }
  return { data: output, width, height, encoded: false };
}

export function decodeIco(body: Buffer): DecodedIcoFrame | null {
  if (body.length < 22 || body.readUInt16LE(0) !== 0 || body.readUInt16LE(2) !== 1) return null;
  const count = body.readUInt16LE(4);
  const entries: Array<{ area: number; offset: number; size: number }> = [];
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    if (entry + 16 > body.length) break;
    const width = body[entry] === 0 ? 256 : body[entry] ?? 0;
    const height = body[entry + 1] === 0 ? 256 : body[entry + 1] ?? 0;
    const size = body.readUInt32LE(entry + 8);
    const offset = body.readUInt32LE(entry + 12);
    if (offset + size <= body.length) entries.push({ area: width * height, offset, size });
  }
  entries.sort((first, second) => second.area - first.area);
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  for (const entry of entries) {
    const encoded = body.subarray(entry.offset, entry.offset + entry.size);
    if (encoded.subarray(0, 8).equals(pngSignature)) {
      return { data: encoded, width: 0, height: 0, encoded: true };
    }
    const decoded = decodeDibFrame(body, entry.offset, entry.size);
    if (decoded) return decoded;
  }
  return null;
}

async function transformUncached(image: VerifiedImage, options: TransformOptions): Promise<ServedImage> {
  if (options.format === 'original' && options.size === null) {
    return { url: image.url, body: image.body, type: image.metadata.type, format: image.metadata.format };
  }

  const outputFormat = options.format === 'original' ? 'png' : options.format;
  const ico = image.metadata.format === 'ico' ? decodeIco(image.body) : null;
  return transforms.run(async () => {
    try {
      const commonOptions = { animated: false, density: 240, limitInputPixels: 4096 * 4096 } as const;
      let pipeline = ico && !ico.encoded
        ? sharp(ico.data, { ...commonOptions, raw: { width: ico.width, height: ico.height, channels: 4 } })
        : sharp(ico?.data ?? image.body, commonOptions);
      pipeline = pipeline.rotate();
      if (options.size !== null) {
        pipeline = pipeline.resize(options.size, options.size, {
          fit: 'contain',
          withoutEnlargement: false,
        });
      }
      if (outputFormat === 'png') pipeline = pipeline.png({ compressionLevel: 9, palette: false });
      if (outputFormat === 'webp') pipeline = pipeline.webp({ quality: 90, effort: 4 });
      if (outputFormat === 'jpeg') pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: 92, mozjpeg: true });
      if (outputFormat === 'avif') pipeline = pipeline.avif({ quality: 72, effort: 4 });
      return {
        url: image.url,
        body: await pipeline.toBuffer(),
        type: MIME_BY_FORMAT[outputFormat],
        format: outputFormat,
      };
    } catch {
      throw new AppError('CONVERSION_FAILED', '该图标无法转换为所选格式，请尝试 PNG 或保留原格式。', 422);
    }
  });
}

export async function serveImage(input: string, options: TransformOptions): Promise<ServedImage> {
  const image = await fetchVerifiedImage(input);
  const key = `${image.url}|${options.format}|${options.size ?? 'original'}`;
  const cached = transformedCache.get(key);
  if (cached) return cached;
  const pending = transformInFlight.get(key);
  if (pending) return pending;

  const promise = transformUncached(image, options)
    .then((converted) => {
      transformedCache.set(key, converted);
      return converted;
    })
    .finally(() => transformInFlight.delete(key));
  transformInFlight.set(key, promise);
  return promise;
}
