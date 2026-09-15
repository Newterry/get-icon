import assert from 'node:assert/strict';
import test from 'node:test';
import { isBlockedAddress, normalizeWebsiteUrl } from '../src/security.js';

test('normalizes bare domains and preserves paths', () => {
  assert.equal(normalizeWebsiteUrl('apple.com').href, 'https://apple.com/');
  assert.equal(normalizeWebsiteUrl('https://example.com/path').href, 'https://example.com/path');
});

test('rejects invalid and unsupported URLs', () => {
  assert.throws(() => normalizeWebsiteUrl('abc'), /域名后缀/u);
  assert.throws(() => normalizeWebsiteUrl('file:///etc/passwd'), /仅支持/u);
});

test('blocks private, loopback, link-local and reserved addresses', () => {
  for (const address of ['127.0.0.1', '10.2.3.4', '172.16.4.2', '192.168.1.1', '169.254.1.1', '0.0.0.0', '::1', 'fc00::1', 'fe80::1', '192.0.2.1']) {
    assert.equal(isBlockedAddress(address), true, address);
  }
  assert.equal(isBlockedAddress('1.1.1.1'), false);
  assert.equal(isBlockedAddress('2606:4700:4700::1111'), false);
});
