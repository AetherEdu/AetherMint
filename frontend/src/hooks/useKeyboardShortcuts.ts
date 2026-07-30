'use client';

import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  category: string;
  handler: () => void;
}

export interface ShortcutRegistration {
  id: string;
  shortcuts: KeyboardShortcut[];
}

const isTypingField = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
};

function matchesShortcut(e: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  if (shortcut.key !== e.key && shortcut.key !== e.code) return false;

  const eventHasCtrl = e.ctrlKey || e.metaKey;
  const eventHasShift = e.shiftKey;
  const eventHasAlt = e.altKey;

  if (shortcut.ctrl && !eventHasCtrl) return false;
  if (!shortcut.ctrl && eventHasCtrl) return false;
  if (shortcut.shift && !eventHasShift) return false;
  if (!shortcut.shift && eventHasShift) return false;
  if (shortcut.alt && !eventHasAlt) return false;
  if (!shortcut.alt && eventHasAlt) return false;

  return true;
}

const registry: ShortcutRegistration[] = [];
let listenerAttached = false;
let globalHandler: ((e: KeyboardEvent) => void) | null = null;

function buildGlobalHandler(): (e: KeyboardEvent) => void {
  return (e: KeyboardEvent) => {
    if (isTypingField(e.target)) return;

    for (const registration of registry) {
      for (const shortcut of registration.shortcuts) {
        if (matchesShortcut(e, shortcut)) {
          e.preventDefault();
          e.stopPropagation();
          shortcut.handler();
          return;
        }
      }
    }
  };
}

function attachListener() {
  if (listenerAttached) return;
  globalHandler = buildGlobalHandler();
  document.addEventListener('keydown', globalHandler);
  listenerAttached = true;
}

function detachListener() {
  if (!listenerAttached || !globalHandler) return;
  document.removeEventListener('keydown', globalHandler);
  globalHandler = null;
  listenerAttached = false;
}

export function registerShortcuts(registration: ShortcutRegistration): () => void {
  registry.push(registration);
  attachListener();

  return () => {
    const idx = registry.findIndex((r) => r.id === registration.id);
    if (idx !== -1) registry.splice(idx, 1);
    if (registry.length === 0) detachListener();
  };
}

export function getAllShortcuts(): KeyboardShortcut[] {
  const seen = new Set<string>();
  const all: KeyboardShortcut[] = [];
  for (const registration of registry) {
    for (const shortcut of registration.shortcuts) {
      const key = `${shortcut.key}-${shortcut.ctrl}-${shortcut.shift}-${shortcut.alt}`;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(shortcut);
      }
    }
  }
  return all;
}

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  id: string,
  isActive: boolean = true
) {
  const registrationRef = useRef<ShortcutRegistration | null>(null);

  const cleanup = useCallback(() => {
    if (registrationRef.current) {
      const reg = registry.find((r) => r.id === id);
      if (reg) {
        const idx = registry.indexOf(reg);
        if (idx !== -1) registry.splice(idx, 1);
      }
      registrationRef.current = null;
      if (registry.length === 0) detachListener();
    }
  }, [id]);

  useEffect(() => {
    if (!isActive) {
      cleanup();
      return;
    }

    const registration: ShortcutRegistration = { id, shortcuts };
    registry.push(registration);
    registrationRef.current = registration;
    attachListener();

    return cleanup;
  }, [shortcuts, id, isActive, cleanup]);
}

export function useGlobalKeyboardShortcuts() {
  const openSearch = useCallback(() => {
    const event = new CustomEvent('keyboard-shortcut:search');
    window.dispatchEvent(event);
  }, []);

  const showHelp = useCallback(() => {
    const event = new CustomEvent('keyboard-shortcut:show-help');
    window.dispatchEvent(event);
  }, []);

  const closeAll = useCallback(() => {
    const event = new CustomEvent('keyboard-shortcut:close');
    window.dispatchEvent(event);
  }, []);

  useEffect(() => {
    const registration: ShortcutRegistration = {
      id: 'global',
      shortcuts: [
        {
          key: 'k',
          ctrl: true,
          description: 'Open search',
          category: 'Global',
          handler: openSearch,
        },
        {
          key: '/',
          ctrl: true,
          description: 'Open search',
          category: 'Global',
          handler: openSearch,
        },
        {
          key: '?',
          shift: true,
          description: 'Show keyboard shortcuts',
          category: 'Global',
          handler: showHelp,
        },
        {
          key: 'Escape',
          description: 'Close dialogs / dismiss',
          category: 'Global',
          handler: closeAll,
        },
        {
          key: 'j',
          description: 'Scroll down',
          category: 'Navigation',
          handler: () => window.scrollBy({ top: window.innerHeight * 0.4, behavior: 'smooth' }),
        },
        {
          key: 'k',
          description: 'Scroll up',
          category: 'Navigation',
          handler: () => window.scrollBy({ top: -window.innerHeight * 0.4, behavior: 'smooth' }),
        },
        {
          key: 'g',
          description: 'Go to top',
          category: 'Navigation',
          handler: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
        },
        {
          key: 'G',
          shift: true,
          description: 'Go to bottom',
          category: 'Navigation',
          handler: () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }),
        },
      ],
    };

    registry.push(registration);
    attachListener();

    return () => {
      const idx = registry.indexOf(registration);
      if (idx !== -1) registry.splice(idx, 1);
      if (registry.length === 0) detachListener();
    };
  }, [openSearch, showHelp, closeAll]);
}
