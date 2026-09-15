import sharp from 'sharp';

export interface ImageMetadata {
  width: number | null;
  height: number | null;
  type: string;
  format: string;
  vector: boolean;
}

const MIME_BY_FORMAT: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
};

function svgMetadata(body: Buffer): ImageMetadata | null {
  const prefix = body.subarray(0, 64 * 1024).toString('utf8');
  const match = prefix.match(/<svg\b[^>]*>/iu);
  if (!match) return null;
  const tag = match[0];
  const dimension = (name: string): number | null => {
    const value = tag.match(new RegExp(`${name}\\s*=\\s*["']\\s*([\\d.]+)`, 'iu'))?.[1];
    const parsed = value ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
  };
  let width = dimension('width');
  let height = dimension('height');
  const viewBox = tag.match(/viewBox\s*=\s*["']\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)/iu);
  if ((!width || !height) && viewBox) {
    width ??= Math.round(Number(viewBox[1]));
    height ??= Math.round(Number(viewBox[2]));
  }
  return { width, height, type: 'image/svg+xml', format: 'svg', vector: true };
}

function icoMetadata(body: Buffer): ImageMetadata | null {
  if (body.length < 22 || body.readUInt16LE(0) !== 0 || body.readUInt16LE(2) !== 1) return null;
  const count = body.readUInt16LE(4);
  let width = 0;
  let height = 0;
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    if (offset + 16 > body.length) break;
    const candidateWidth = body[offset] === 0 ? 256 : body[offset] ?? 0;
    const candidateHeight = body[offset + 1] === 0 ? 256 : body[offset + 1] ?? 0;
    if (candidateWidth * candidateHeight > width * height) {
      width = candidateWidth;
      height = candidateHeight;
    }
  }
  return { width: width || null, height: height || null, type: 'image/x-icon', format: 'ico', vector: false };
}

export async function inspectImage(body: Buffer, contentType?: string): Promise<ImageMetadata | null> {
  const svg = svgMetadata(body);
  if (svg) return svg;
  const ico = icoMetadata(body);
  if (ico) return ico;
  try {
    const metadata = await sharp(body, { animated: true }).metadata();
    if (!metadata.format) return null;
    const format = metadata.format.toLowerCase();
    return {
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      type: MIME_BY_FORMAT[format] ?? contentType?.split(';')[0] ?? `image/${format}`,
      format,
      vector: false,
    };
  } catch {
    return null;
  }
}
