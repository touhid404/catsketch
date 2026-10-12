import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveDraft, readDraft } from '../apps/web/src/features/drafts/lib/draft-storage';

test('a late private canvas save cannot erase its published room link', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage: Record<string, string> = {};
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
    },
  });
  try {
    const draft = {
      id: '00000000-0000-0000-0000-000000000000',
      title: 'Shared sketch',
      elements: [],
      updatedAt: new Date().toISOString(),
    };
    saveDraft(draft);
    const lateCanvasSave = { ...draft, elements: [...draft.elements] };
    saveDraft({ ...draft, publishedCode: 'abcdefghijkl' });
    saveDraft(lateCanvasSave);
    assert.equal(readDraft(draft.id)?.publishedCode, 'abcdefghijkl');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
