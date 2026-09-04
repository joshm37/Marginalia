import { beforeEach, describe, expect, it, vi } from "vitest";

let queue;

beforeEach(() => {
  queue = [];
  globalThis.chrome = {
    storage: {
      local: {
        get: vi.fn(async () => ({ marginaliaRequestQueue: queue })),
        set: vi.fn(async ({ marginaliaRequestQueue }) => {
          queue = marginaliaRequestQueue;
        }),
      },
    },
  };
});

describe("extension retry queue", () => {
  it("persists a failed capture and removes it after successful delivery", async () => {
    const { enqueueRequest, processQueue } = await import("../../extension/queue-service.js");
    await enqueueRequest("source", { title: "Queued source" });
    expect(queue).toHaveLength(1);
    const send = vi.fn().mockResolvedValue({ id: "saved" });
    await expect(processQueue(send)).resolves.toEqual({ completed: 1, remaining: 0 });
    expect(send).toHaveBeenCalledOnce();
    expect(queue).toHaveLength(0);
  });

  it("retains captures when the account session has expired", async () => {
    const { enqueueRequest, processQueue } = await import("../../extension/queue-service.js");
    await enqueueRequest("excerpt", { selectedText: "Evidence" });
    const error = Object.assign(new Error("Sign in again"), { code: "SESSION_EXPIRED" });
    await processQueue(vi.fn().mockRejectedValue(error));
    expect(queue).toHaveLength(1);
    expect(queue[0].attempts).toBe(0);
  });
});
