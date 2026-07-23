"use client";

import { useEffect } from "react";

export type IdleGateId = "recipe-timer" | "guestbook-capture";

const counts: Record<IdleGateId, number> = {
  "recipe-timer": 0,
  "guestbook-capture": 0,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function claimIdleGate(id: IdleGateId): void {
  counts[id] += 1;
  notify();
}

export function releaseIdleGate(id: IdleGateId): void {
  counts[id] = Math.max(0, counts[id] - 1);
  notify();
}

export function isIdleBlockedByGates(): boolean {
  return counts["recipe-timer"] > 0 || counts["guestbook-capture"] > 0;
}

export function subscribeIdleGates(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Keep an idle gate claimed while `active` is true. */
export function useIdleGate(id: IdleGateId, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    claimIdleGate(id);
    return () => releaseIdleGate(id);
  }, [id, active]);
}
