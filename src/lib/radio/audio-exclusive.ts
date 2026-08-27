/** Keep the house stream and Settings test player from overlapping. */

let stopRadio: (() => void) | null = null;
let stopTest: (() => void) | null = null;

export function registerRadioStop(fn: () => void) {
  stopRadio = fn;
}

export function registerTestStop(fn: () => void) {
  stopTest = fn;
}

export function exclusiveRadio() {
  stopTest?.();
}

export function exclusiveTest() {
  stopRadio?.();
}
