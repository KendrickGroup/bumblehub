type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Listener = () => void;

let promptEvent: BeforeInstallPromptEvent | null = null;
let accepted = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function bindInstallPrompt(): () => void {
  if (typeof window === "undefined") return () => {};
  const flag = window as Window & { __latigoPromptBound?: boolean };
  if (flag.__latigoPromptBound) return () => {};
  flag.__latigoPromptBound = true;

  const onPrompt = (event: Event) => {
    event.preventDefault();
    promptEvent = event as BeforeInstallPromptEvent;
    emit();
  };
  const onInstalled = () => {
    accepted = true;
    promptEvent = null;
    emit();
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
    flag.__latigoPromptBound = false;
  };
}

export function installPromptReady(): boolean {
  return Boolean(promptEvent) && !accepted;
}

export function installWasAccepted(): boolean {
  return accepted;
}

export function subscribeInstallPrompt(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function runInstallPrompt(): Promise<void> {
  const event = promptEvent;
  if (!event) return;
  await event.prompt();
  const choice = await event.userChoice;
  promptEvent = null;
  if (choice.outcome === "accepted") accepted = true;
  emit();
}
