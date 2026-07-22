// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore The OpenNext worker is generated immediately before bundling.
import handler from "./.open-next/worker.js";
import { drainNativePushBatch } from "./src/lib/native-push/sender";
import type { NativePushDeliveryEnvironment } from "./src/lib/native-push/sender-core";

type ScheduledController = {
  waitUntil(promise: Promise<unknown>): void;
};

const worker = {
  fetch: handler.fetch,
  scheduled(
    _event: unknown,
    env: NativePushDeliveryEnvironment,
    controller: ScheduledController,
  ) {
    controller.waitUntil(drainNativePushBatch(env));
  },
};

export default worker;
