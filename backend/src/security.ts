import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { AppError } from './errors.js';

const MAX_URL_LENGTH = 2048;

export function normalizeWebsiteUrl(input: string): URL {
  const value = input.trim();
  const containsUnsafeWhitespace = [...value].some((character) => character.charCodeAt(0) <= 32);
  if (!value || value.length > MAX_URL_LENGTH || containsUnsafeWhitespace) {
    throw new AppError('INVALID_URL', '请输入有效的网站地址。');
  }

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//iu.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new AppError('INVALID_URL', '网址格式不正确，请输入域名或完整 URL。');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError('UNSUPPORTED_PROTOCOL', '仅支持 http 和 https 地址。');
  }
  if (url.username || url.password) {
    throw new AppError('INVALID_URL', '网址不能包含用户名或密码。');
  }
  if (!url.hostname || (!url.hostname.includes('.') && isIP(url.hostname) === 0)) {
    throw new AppError('INVALID_URL', '请输入包含有效域名后缀的网站地址。');
  }
  url.hash = '';
  return url;
}

export function isBlockedAddress(address: string): boolean {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(address);
  } catch {
    return true;
  }

  if (parsed.kind() === 'ipv6') {
    const ipv6 = parsed as ipaddr.IPv6;
    if (ipv6.isIPv4MappedAddress()) parsed = ipv6.toIPv4Address();
  }

  const range = parsed.range();
  return range !== 'unicast';
}

function isBenchmarkFakeIp(address: string): boolean {
  if (!ipaddr.IPv4.isValid(address)) return false;
  const [first, second] = address.split('.').map(Number);
  return first === 198 && (second === 18 || second === 19);
}

function blockedForConnection(address: string): boolean {
  const fakeIpCompatibility = process.env.ALLOW_DNS_FAKE_IP === 'true';
  return isBlockedAddress(address) && !(fakeIpCompatibility && isBenchmarkFakeIp(address));
}

export async function resolvePublicAddress(hostname: string): Promise<{ address: string; family: 4 | 6 }> {
  if (hostname.toLowerCase() === 'localhost' || hostname.endsWith('.localhost')) {
    throw new AppError('SSRF_BLOCKED', '出于安全原因，不能访问本机或内网地址。', 403);
  }

  if (isIP(hostname)) {
    if (blockedForConnection(hostname)) {
      throw new AppError('SSRF_BLOCKED', '出于安全原因，不能访问本机或内网地址。', 403);
    }
    return { address: hostname, family: isIP(hostname) as 4 | 6 };
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new AppError('DNS_ERROR', '无法解析该网站的域名，请检查地址是否正确。', 502);
  }
  if (!addresses.length) {
    throw new AppError('DNS_ERROR', '该域名没有可用的网络地址。', 502);
  }
  if (addresses.some((entry) => blockedForConnection(entry.address))) {
    throw new AppError('SSRF_BLOCKED', '该域名解析到了本机、内网或保留地址，访问已被拒绝。', 403);
  }
  const selected = [...addresses].sort((a, b) => a.family - b.family)[0];
  if (!selected) throw new AppError('DNS_ERROR', '该域名没有可用的网络地址。', 502);
  return { address: selected.address, family: selected.family as 4 | 6 };
}
