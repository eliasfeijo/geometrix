// The lab's worker (plan section 13, P10): the local authoritative server.
// LabHost does the work; this file only wires it to the worker's messages,
// its clock and Web Crypto.

import { LabHost, webSha256 } from "./host.ts";
import type { FromWorker, ToWorker } from "./protocol.ts";

const scope = self as unknown as {
  postMessage(message: FromWorker): void;
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
};

const host = new LabHost(
  (message) => scope.postMessage(message),
  {
    now: () => performance.now(),
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  },
  webSha256,
);

scope.onmessage = (event) => host.handle(event.data);
