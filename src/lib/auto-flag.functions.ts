import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CheckLinkInput = z.object({
  url: z.string().url().max(2000),
  timeoutMs: z.number().int().min(500).max(60000).optional(),
});

export const checkLinkReachable = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CheckLinkInput.parse(input))
  .handler(async ({ data }) => {
    const timeoutMs = data.timeoutMs ?? 8000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let res: Response;
      try {
        res = await fetch(data.url, {
          method: "HEAD",
          redirect: "follow",
          signal: controller.signal,
          headers: { "user-agent": "FreducationLinkCheck/1.0" },
        });
        if (res.status === 405 || res.status === 403) {
          res = await fetch(data.url, {
            method: "GET",
            redirect: "follow",
            signal: controller.signal,
            headers: { "user-agent": "FreducationLinkCheck/1.0" },
          });
        }
      } catch {
        res = await fetch(data.url, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: { "user-agent": "FreducationLinkCheck/1.0" },
        });
      }
      return { ok: res.status >= 200 && res.status < 400, status: res.status };
    } catch (err) {
      return { ok: false, status: 0, error: err instanceof Error ? err.message : "unreachable" };
    } finally {
      clearTimeout(timer);
    }
  });
