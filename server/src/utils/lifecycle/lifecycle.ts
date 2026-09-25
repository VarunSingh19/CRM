/**
 * Process lifecycle shared by server.ts (which starts the shutdown) and the
 * health controller (which reports it). Once draining, /ready answers 503 so
 * a load balancer stops sending new requests while in-flight ones finish.
 */
let draining = false;

export function markDraining(): void {
  draining = true;
}

export function isDraining(): boolean {
  return draining;
}
