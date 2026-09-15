import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryCache } from '../src/cache.js';
import { Semaphore } from '../src/concurrency.js';
import { decodeIco, parseTransformOptions } from '../src/image-service.js';

test('validates icon conversion format and size', () => {
  assert.deepEqual(parseTransformOptions('webp', '256'), { format: 'webp', size: 256 });
  assert.deepEqual(parseTransformOptions(undefined, undefined), { format: 'original', size: null });
  assert.throws(() => parseTransformOptions('gif', '256'), /输出格式/u);
  assert.throws(() => parseTransformOptions('png', '4096'), /输出尺寸/u);
});

test('memory cache evicts the least recently used entry', () => {
  const cache = new MemoryCache<number>(60_000, 2);
  cache.set('a', 1);
  cache.set('b', 2);
  assert.equal(cache.get('a'), 1);
  cache.set('c', 3);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('c'), 3);
});

test('semaphore caps concurrent work without dropping tasks', async () => {
  const semaphore = new Semaphore(2);
  let active = 0;
  let peak = 0;
  const tasks = Array.from({ length: 8 }, (_, index) => semaphore.run(async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 4));
    active -= 1;
    return index;
  }));
  assert.deepEqual(await Promise.all(tasks), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(peak, 2);
});

test('decodes a palette-based ICO DIB frame to RGBA', () => {
  const icon = Buffer.alloc(86);
  icon.writeUInt16LE(1, 2);
  icon.writeUInt16LE(1, 4);
  icon[6] = 2;
  icon[7] = 2;
  icon[8] = 2;
  icon[12] = 1;
  icon.writeUInt16LE(1, 10);
  icon.writeUInt32LE(64, 14);
  icon.writeUInt32LE(22, 18);
  icon.writeUInt32LE(40, 22);
  icon.writeInt32LE(2, 26);
  icon.writeInt32LE(4, 30);
  icon.writeUInt16LE(1, 34);
  icon.writeUInt16LE(4, 36);
  icon.writeUInt32LE(2, 54);
  icon.set([0, 0, 0, 0, 255, 255, 255, 0], 62);
  icon.set([0x10, 0, 0, 0, 0x01, 0, 0, 0], 70);
  const decoded = decodeIco(icon);
  assert.ok(decoded);
  assert.equal(decoded.encoded, false);
  assert.equal(decoded.width, 2);
  assert.equal(decoded.height, 2);
  assert.deepEqual([...decoded.data.subarray(0, 8)], [0, 0, 0, 255, 255, 255, 255, 255]);
});
