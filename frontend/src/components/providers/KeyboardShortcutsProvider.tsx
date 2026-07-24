'use client';

import { useGlobalKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { KeyboardShortcutsDialog } from '@/components/KeyboardShortcutsDialog';

export function KeyboardShortcutsProvider() {
  useGlobalKeyboardShortcuts();

  return <KeyboardShortcutsDialog />;
}

export default KeyboardShortcutsProvider;
