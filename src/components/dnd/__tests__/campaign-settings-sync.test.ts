import { describe, it, expect } from "vitest";
import {
  shouldSyncCampaignSettings,
  shouldAutoScrollChat,
} from "../scroll-and-sync-helpers";

describe("shouldSyncCampaignSettings", () => {
  it("allows sync on initial campaign load", () => {
    expect(shouldSyncCampaignSettings(null, "camp-1")).toBe(true);
  });

  it("blocks sync when polling the same campaign to prevent input resets", () => {
    expect(shouldSyncCampaignSettings("camp-1", "camp-1")).toBe(false);
  });

  it("allows sync when switching to a different campaign", () => {
    expect(shouldSyncCampaignSettings("camp-1", "camp-2")).toBe(true);
  });

  it("blocks sync when campaign is null", () => {
    expect(shouldSyncCampaignSettings("camp-1", null)).toBe(false);
    expect(shouldSyncCampaignSettings(null, null)).toBe(false);
  });
});

describe("shouldAutoScrollChat", () => {
  it("never auto-scrolls when messages count is 0", () => {
    expect(
      shouldAutoScrollChat({
        messagesCount: 0,
        prevMessagesCount: 0,
        isInitial: true,
        isNearBottom: true,
      })
    ).toBe(false);

    expect(
      shouldAutoScrollChat({
        messagesCount: 0,
        prevMessagesCount: 0,
        isInitial: false,
        isNearBottom: false,
      })
    ).toBe(false);
  });

  it("auto-scrolls on initial load of chat history", () => {
    expect(
      shouldAutoScrollChat({
        messagesCount: 10,
        prevMessagesCount: 0,
        isInitial: true,
        isNearBottom: false,
      })
    ).toBe(true);
  });

  it("blocks auto-scroll on periodic polling when no new messages arrived", () => {
    expect(
      shouldAutoScrollChat({
        messagesCount: 10,
        prevMessagesCount: 10,
        isInitial: false,
        isNearBottom: true,
      })
    ).toBe(false);
  });

  it("auto-scrolls when a new message arrives and user is near bottom", () => {
    expect(
      shouldAutoScrollChat({
        messagesCount: 11,
        prevMessagesCount: 10,
        isInitial: false,
        isNearBottom: true,
      })
    ).toBe(true);
  });

  it("preserves scroll position when new message arrives but user scrolled up to read history", () => {
    expect(
      shouldAutoScrollChat({
        messagesCount: 11,
        prevMessagesCount: 10,
        isInitial: false,
        isNearBottom: false,
      })
    ).toBe(false);
  });
});
