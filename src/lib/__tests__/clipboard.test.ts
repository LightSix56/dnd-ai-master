import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { copyToClipboard } from "../utils";

describe("copyToClipboard", () => {
  const originalNavigator = global.navigator;
  const originalDocument = global.document;
  const originalWindow = (global as any).window;

  beforeEach(() => {
    vi.restoreAllMocks();
    (global as any).window = {};
  });

  afterEach(() => {
    (global as any).window = originalWindow;
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
    });
    Object.defineProperty(global, "document", {
      value: originalDocument,
      writable: true,
    });
  });

  it("uses navigator.clipboard.writeText when clipboard API is available (HTTPS / Localhost)", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global, "navigator", {
      value: {
        clipboard: {
          writeText: writeTextMock,
        },
      },
      writable: true,
    });

    const result = await copyToClipboard("http://localhost:3000/room/ABC123");
    expect(result).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith("http://localhost:3000/room/ABC123");
  });

  it("gracefully falls back to document.execCommand when navigator.clipboard is undefined (HTTP / LAN / Radmin)", async () => {
    // В незащищённом HTTP контексте (например, 192.168.0.53 или 26.X.Y.Z) navigator.clipboard равен undefined
    Object.defineProperty(global, "navigator", {
      value: {},
      writable: true,
    });

    const execCommandMock = vi.fn().mockReturnValue(true);
    const mockTextArea = {
      value: "",
      style: {} as any,
      setAttribute: vi.fn(),
      focus: vi.fn(),
      select: vi.fn(),
    };

    const appendChildMock = vi.fn();
    const removeChildMock = vi.fn();

    Object.defineProperty(global, "document", {
      value: {
        createElement: vi.fn().mockReturnValue(mockTextArea),
        body: {
          appendChild: appendChildMock,
          removeChild: removeChildMock,
        },
        execCommand: execCommandMock,
      },
      writable: true,
    });

    const result = await copyToClipboard("http://192.168.0.53:3000/room/XYZ789");
    expect(result).toBe(true);
    expect(mockTextArea.value).toBe("http://192.168.0.53:3000/room/XYZ789");
    expect(mockTextArea.select).toHaveBeenCalled();
    expect(execCommandMock).toHaveBeenCalledWith("copy");
    expect(removeChildMock).toHaveBeenCalled();
  });

  it("handles failure safely without throwing exceptions", async () => {
    Object.defineProperty(global, "navigator", {
      value: {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error("Permission denied")),
        },
      },
      writable: true,
    });

    Object.defineProperty(global, "document", {
      value: {
        createElement: vi.fn().mockImplementation(() => {
          throw new Error("DOM error");
        }),
      },
      writable: true,
    });

    const result = await copyToClipboard("http://example.com");
    expect(result).toBe(false);
  });
});
