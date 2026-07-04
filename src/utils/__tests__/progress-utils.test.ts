import { describe, it, expect, vi } from "vitest";
import { buildProgressContext, sendProgress, createBatchProgressReporter } from "../progress-utils.js";
import type { RequestContext } from "../../types/index.js";

describe("progress-utils", () => {
  describe("buildProgressContext", () => {
    it("returns undefined if ctx is undefined", () => {
      expect(buildProgressContext(undefined)).toBeUndefined();
    });

    it("returns undefined if server or progressToken is missing", () => {
      expect(buildProgressContext({ server: {} } as RequestContext)).toBeUndefined();
      expect(buildProgressContext({ progressToken: 123 } as RequestContext)).toBeUndefined();
    });

    it("returns undefined if server does not have notification capability", () => {
      const ctx = { server: { notNotificationSender: true }, progressToken: 123 } as any;
      expect(buildProgressContext(ctx)).toBeUndefined();
    });

    it("builds context when server directly has notification method", () => {
      const server = { notification: vi.fn() };
      const ctx = { server, progressToken: 123 } as any;
      const res = buildProgressContext(ctx);
      expect(res).toEqual({ server, progressToken: 123 });
    });

    it("builds context when server is wrapped (inner server)", () => {
      const innerServer = { notification: vi.fn() };
      const ctx = { server: { server: innerServer }, progressToken: 123 } as any;
      const res = buildProgressContext(ctx);
      expect(res).toEqual({ server: innerServer, progressToken: 123 });
    });
  });

  describe("sendProgress", () => {
    it("does nothing if ctx or progressToken is missing", async () => {
      await expect(sendProgress(undefined, 10)).resolves.toBeUndefined();
      await expect(sendProgress({ server: { notification: vi.fn() } }, 10)).resolves.toBeUndefined();
    });

    it("sends notification with progress", async () => {
      const notificationSpy = vi.fn().mockResolvedValue(undefined);
      const ctx = { server: { notification: notificationSpy }, progressToken: "token123" };
      await sendProgress(ctx, 50);
      
      expect(notificationSpy).toHaveBeenCalledWith({
        method: "notifications/progress",
        params: {
          progressToken: "token123",
          progress: 50
        }
      });
    });

    it("sends notification with total and message", async () => {
      const notificationSpy = vi.fn().mockResolvedValue(undefined);
      const ctx = { server: { notification: notificationSpy }, progressToken: "token123" };
      await sendProgress(ctx, 50, 100, "Processing...");
      
      expect(notificationSpy).toHaveBeenCalledWith({
        method: "notifications/progress",
        params: {
          progressToken: "token123",
          progress: 50,
          total: 100,
          message: "Processing..."
        }
      });
    });

    it("ignores notification failures", async () => {
      const notificationSpy = vi.fn().mockRejectedValue(new Error("Network error"));
      const ctx = { server: { notification: notificationSpy }, progressToken: "token123" };
      await expect(sendProgress(ctx, 50)).resolves.toBeUndefined();
    });
  });

  describe("createBatchProgressReporter", () => {
    it("reports progress at throttle intervals and at completion", async () => {
      const notificationSpy = vi.fn().mockResolvedValue(undefined);
      const ctx = { server: { notification: notificationSpy }, progressToken: "token123" };
      
      const reporter = createBatchProgressReporter(ctx, 25, 10);
      
      await reporter(5); // Not reported (diff = 5 < 10)
      expect(notificationSpy).not.toHaveBeenCalled();
      
      await reporter(10); // Reported (diff = 10)
      expect(notificationSpy).toHaveBeenCalledTimes(1);
      
      await reporter(19); // Not reported
      expect(notificationSpy).toHaveBeenCalledTimes(1);
      
      await reporter(20); // Reported
      expect(notificationSpy).toHaveBeenCalledTimes(2);
      
      await reporter(24); // Not reported
      expect(notificationSpy).toHaveBeenCalledTimes(2);
      
      await reporter(25, "Done"); // Reported (completed)
      expect(notificationSpy).toHaveBeenCalledTimes(3);
      expect(notificationSpy).toHaveBeenLastCalledWith({
        method: "notifications/progress",
        params: {
          progressToken: "token123",
          progress: 25,
          total: 25,
          message: "Done"
        }
      });
    });
  });
});
