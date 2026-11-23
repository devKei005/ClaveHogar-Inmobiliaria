import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let globalIsInstalled = false;
const listeners = new Set<() => void>();

function checkStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function checkIsIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
}

function emitChange() {
  listeners.forEach((cb) => cb());
}

if (typeof window !== 'undefined') {
  globalIsInstalled = checkStandalone();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    emitChange();
  });

  window.addEventListener('appinstalled', () => {
    globalIsInstalled = true;
    globalDeferredPrompt = null;
    emitChange();
  });
}

export function usePWAInstall() {
  const [, setTick] = useState(0);
  const [isIOS] = useState(() => checkIsIOS());

  useEffect(() => {
    const update = () => setTick((t) => t + 1);
    listeners.add(update);
    // Sync standalone status in case display-mode changed
    const currentStandalone = checkStandalone();
    if (currentStandalone && !globalIsInstalled) {
      globalIsInstalled = true;
      update();
    }
    return () => {
      listeners.delete(update);
    };
  }, []);

  const install = async () => {
    if (!globalDeferredPrompt) return false;
    await globalDeferredPrompt.prompt();
    const { outcome } = await globalDeferredPrompt.userChoice;
    if (outcome === 'accepted') {
      globalIsInstalled = true;
      globalDeferredPrompt = null;
      emitChange();
      return true;
    }
    return false;
  };

  return {
    isInstallable: Boolean(globalDeferredPrompt),
    isInstalled: globalIsInstalled,
    isIOS,
    install,
  };
}
