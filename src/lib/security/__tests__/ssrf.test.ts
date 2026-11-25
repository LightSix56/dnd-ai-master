import { describe, it, expect, vi, beforeEach } from "vitest";
import { assertSafePublicHttpsUrl, isForbiddenIp, safeFetch, SsrfError } from "../ssrf";

describe("SSRF Protection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("isForbiddenIp", () => {
    it("blocks private, loopback, link-local, CGNAT, and mapped IPv6 addresses", () => {
      expect(isForbiddenIp("127.0.0.1")).toBe(true);
      expect(isForbiddenIp("10.0.0.5")).toBe(true);
      expect(isForbiddenIp("172.16.0.1")).toBe(true);
      expect(isForbiddenIp("172.31.255.254")).toBe(true);
      expect(isForbiddenIp("192.168.1.10")).toBe(true);
      expect(isForbiddenIp("169.254.169.254")).toBe(true);
      expect(isForbiddenIp("100.64.0.1")).toBe(true);
      expect(isForbiddenIp("0.0.0.0")).toBe(true);
      expect(isForbiddenIp("224.0.0.1")).toBe(true);
      expect(isForbiddenIp("::1")).toBe(true);
      expect(isForbiddenIp("::")).toBe(true);
      expect(isForbiddenIp("fe80::1")).toBe(true);
      expect(isForbiddenIp("fc00::1")).toBe(true);
      expect(isForbiddenIp("fd12:3456::1")).toBe(true);
      expect(isForbiddenIp("::ffff:127.0.0.1")).toBe(true);
      expect(isForbiddenIp("::ffff:169.254.169.254")).toBe(true);
    });

    it("allows public IPv4 and IPv6 addresses", () => {
      expect(isForbiddenIp("1.1.1.1")).toBe(false);
      expect(isForbiddenIp("8.8.8.8")).toBe(false);
      expect(isForbiddenIp("172.32.0.1")).toBe(false);
      expect(isForbiddenIp("2606:4700:4700::1111")).toBe(false);
    });
  });

  describe("assertSafePublicHttpsUrl", () => {
    it("rejects non-https schemes, credentials, localhost, and raw private IPs", async () => {
      await expect(assertSafePublicHttpsUrl("http://polza.ai/api/v1")).rejects.toThrow(SsrfError);
      await expect(assertSafePublicHttpsUrl("file:///etc/passwd")).rejects.toThrow(SsrfError);
      await expect(assertSafePublicHttpsUrl("https://user:pass@polza.ai/api/v1")).rejects.toThrow(SsrfError);
      await expect(assertSafePublicHttpsUrl("https://localhost/v1")).rejects.toThrow(SsrfError);
      await expect(assertSafePublicHttpsUrl("https://service.local/v1")).rejects.toThrow(SsrfError);
      await expect(assertSafePublicHttpsUrl("https://metadata.internal/v1")).rejects.toThrow(SsrfError);
      await expect(assertSafePublicHttpsUrl("https://169.254.169.254/latest/meta-data")).rejects.toThrow(SsrfError);
      await expect(assertSafePublicHttpsUrl("https://[::1]/v1")).rejects.toThrow(SsrfError);
    });

    it("rejects hostnames that resolve via DNS to private IPs", async () => {
      const lookup = vi.fn().mockResolvedValue([{ address: "10.0.0.12", family: 4 }]);
      await expect(assertSafePublicHttpsUrl("https://rebind.example.com/v1", { lookup })).rejects.toThrow(SsrfError);
    });

    it("allows public https hostnames resolving to public IPs", async () => {
      const lookup = vi.fn().mockResolvedValue([{ address: "104.21.10.10", family: 4 }]);
      const url = await assertSafePublicHttpsUrl("https://polza.ai/api/v1", { lookup });
      expect(url.href).toBe("https://polza.ai/api/v1");
    });
  });

  describe("safeFetch", () => {
    it("blocks redirects targeting internal hosts", async () => {
      const lookup = vi.fn().mockResolvedValue([{ address: "104.21.10.10", family: 4 }]);
      const fetchMock = vi.fn().mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: "http://127.0.0.1:8080/admin" },
        })
      );

      await expect(
        safeFetch("https://example.com/start", undefined, { lookup, fetchImpl: fetchMock })
      ).rejects.toThrow(SsrfError);
    });

    it("follows safe public https redirects", async () => {
      const lookup = vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(null, {
            status: 302,
            headers: { Location: "https://example.com/final" },
          })
        )
        .mockResolvedValueOnce(new Response("ok", { status: 200 }));

      const res = await safeFetch("https://example.com/start", undefined, { lookup, fetchImpl: fetchMock });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("ok");
    });
  });
});
