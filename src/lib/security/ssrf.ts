import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export class SsrfError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

export type LookupFn = (
  hostname: string,
  options: { all: true }
) => Promise<Array<{ address: string; family: number }>>;

export interface SsrfOptions {
  lookup?: LookupFn;
  fetchImpl?: typeof fetch;
  maxRedirects?: number;
}

const FORBIDDEN_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "metadata",
]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    num = (num << 8) | n;
  }
  return num >>> 0;
}

function isForbiddenIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true;
  const a = (n >>> 24) & 0xff;
  const b = (n >>> 16) & 0xff;
  const c = (n >>> 8) & 0xff;

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
  if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 TEST-NET-3
  if (a >= 224) return true; // Multicast (224+) and reserved (240+)
  return false;
}

function parseIpv6Groups(raw: string): number[] | null {
  const noZone = raw.split("%")[0].toLowerCase();
  // Convert embedded IPv4 suffix if present (e.g. ::ffff:127.0.0.1)
  const lastColon = noZone.lastIndexOf(":");
  let normalized = noZone;
  if (lastColon !== -1 && noZone.slice(lastColon + 1).includes(".")) {
    const v4 = ipv4ToInt(noZone.slice(lastColon + 1));
    if (v4 === null) return null;
    const hi = ((v4 >>> 16) & 0xffff).toString(16);
    const lo = (v4 & 0xffff).toString(16);
    normalized = `${noZone.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - (left.length + right.length);
  if (halves.length === 1 && missing !== 0) return null;
  if (halves.length === 2 && missing < 0) return null;

  const full = [...left, ...Array<string>(Math.max(0, missing)).fill("0"), ...right];
  if (full.length !== 8) return null;

  const groups: number[] = [];
  for (const g of full) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    groups.push(parseInt(g, 16));
  }
  return groups;
}

function isForbiddenIpv6(ip: string): boolean {
  const groups = parseIpv6Groups(ip);
  if (!groups) return true;

  const isZeroPrefix = groups.slice(0, 7).every((g) => g === 0);
  if (isZeroPrefix && (groups[7] === 0 || groups[7] === 1)) return true; // :: and ::1

  // ::ffff:0:0/96 (IPv4-mapped) or ::0:0/96 (IPv4-compatible)
  if (groups.slice(0, 5).every((g) => g === 0) && (groups[5] === 0xffff || groups[5] === 0)) {
    const v4 = `${(groups[6] >>> 8) & 0xff}.${groups[6] & 0xff}.${(groups[7] >>> 8) & 0xff}.${groups[7] & 0xff}`;
    return isForbiddenIpv4(v4);
  }

  // 64:ff9b::/96 NAT64
  if (groups[0] === 0x0064 && groups[1] === 0xff9b && groups.slice(2, 6).every((g) => g === 0)) {
    const v4 = `${(groups[6] >>> 8) & 0xff}.${groups[6] & 0xff}.${(groups[7] >>> 8) & 0xff}.${groups[7] & 0xff}`;
    return isForbiddenIpv4(v4);
  }

  if ((groups[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((groups[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((groups[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (groups[0] === 0x0100 && groups[1] === 0 && groups[2] === 0 && groups[3] === 0) return true; // 100::/64 discard
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true; // 2001:db8::/32 docs

  return false;
}

export function isForbiddenIp(ip: string): boolean {
  const cleaned = ip.replace(/^\[|\]$/g, "").trim();
  const kind = isIP(cleaned);
  if (kind === 4) return isForbiddenIpv4(cleaned);
  if (kind === 6) return isForbiddenIpv6(cleaned);
  return true;
}

/**
 * Synchronous syntactic validation of a URL (scheme, credentials, hostname, port).
 */
export function parsePublicHttpsUrlSyntax(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new SsrfError("Некорректный URL");
  }

  if (url.protocol !== "https:") {
    throw new SsrfError("Разрешены только HTTPS-адреса");
  }
  if (url.username || url.password) {
    throw new SsrfError("Учётные данные в URL запрещены");
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    !host ||
    FORBIDDEN_HOSTNAMES.has(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new SsrfError("Запрещённый локальный или внутренний хост");
  }

  if (url.port) {
    const port = Number(url.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535 || (port < 1024 && port !== 443)) {
      throw new SsrfError("Запрещённый порт в URL");
    }
  }

  const unbracketed = host.replace(/^\[|\]$/g, "");
  if (isIP(unbracketed) !== 0 && isForbiddenIp(unbracketed)) {
    throw new SsrfError("Запрещённый IP-адрес");
  }

  return url;
}

/**
 * Validates that a URL is public HTTPS and does not resolve to private/internal IP addresses.
 */
export async function assertSafePublicHttpsUrl(
  rawUrl: string,
  options: Pick<SsrfOptions, "lookup"> = {}
): Promise<URL> {
  const url = parsePublicHttpsUrlSyntax(rawUrl);
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");

  if (isIP(host) !== 0) {
    if (isForbiddenIp(host)) {
      throw new SsrfError("Запрещённый IP-адрес");
    }
    return url;
  }

  const lookupFn: LookupFn =
    options.lookup ?? ((hostname, opts) => dnsLookup(hostname, opts) as Promise<Array<{ address: string; family: number }>>);

  let records: Array<{ address: string; family: number }>;
  try {
    records = await lookupFn(host, { all: true });
  } catch {
    throw new SsrfError("Не удалось разрешить доменное имя");
  }

  if (!Array.isArray(records) || records.length === 0) {
    throw new SsrfError("Доменное имя не вернуло IP-адресов");
  }

  for (const rec of records) {
    if (isForbiddenIp(rec.address)) {
      throw new SsrfError("Домен указывает на запрещённый внутренний IP-адрес");
    }
  }

  return url;
}

/**
 * Performs fetch with SSRF validation on the target URL and every redirect hop.
 */
export async function safeFetch(
  input: string | URL,
  init: RequestInit = {},
  options: SsrfOptions = {}
): Promise<Response> {
  const fetchFn = options.fetchImpl ?? fetch;
  const maxRedirects = options.maxRedirects ?? 3;

  let currentUrl = await assertSafePublicHttpsUrl(
    typeof input === "string" ? input : input.toString(),
    options
  );
  const initialOrigin = currentUrl.origin;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const headers = new Headers(init.headers);
    if (currentUrl.origin !== initialOrigin) {
      headers.delete("authorization");
      headers.delete("x-api-key");
      headers.delete("cookie");
    }

    const res = await fetchFn(currentUrl.toString(), {
      ...init,
      headers,
      redirect: "manual",
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      if (hop === maxRedirects) {
        throw new SsrfError("Превышено число перенаправлений");
      }
      const nextRaw = new URL(location, currentUrl).toString();
      currentUrl = await assertSafePublicHttpsUrl(nextRaw, options);
      continue;
    }

    return res;
  }

  throw new SsrfError("Превышено число перенаправлений");
}
