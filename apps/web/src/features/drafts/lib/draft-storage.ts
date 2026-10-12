import type { SceneElement } from '@catsketch/shared';
import type { Template } from '../../landing/types';
const PREFIX = 'catsketch:draft:';
export type Draft = {
  id: string;
  title: string;
  elements: SceneElement[];
  updatedAt: string;
  publishedCode?: string;
};
export function readDraft(id: string): Draft | null {
  try {
    const value = JSON.parse(localStorage.getItem(`${PREFIX}${id}`) || 'null');
    return value?.id === id && typeof value.title === 'string' && Array.isArray(value.elements)
      ? value
      : null;
  } catch {
    return null;
  }
}
export function saveDraft(draft: Draft) {
  // Canvas callbacks may save an older object after publication finishes.
  // Keep the published link so that save cannot turn it into a private draft again.
  const publishedCode = draft.publishedCode || readDraft(draft.id)?.publishedCode;
  localStorage.setItem(
    `${PREFIX}${draft.id}`,
    JSON.stringify({ ...draft, ...(publishedCode ? { publishedCode } : {}) }),
  );
}
export async function createDraft(template: Template): Promise<Draft> {
  const draft = {
    id: crypto.randomUUID(),
    title: 'Untitled space',
    elements:
      template === 'blank'
        ? []
        : (await import('../../rooms/lib/templates')).makeTemplate(template),
    updatedAt: new Date().toISOString(),
  };
  saveDraft(draft);
  return draft;
}
export function listDrafts(): Draft[] {
  try {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(PREFIX))
      .map((key) => readDraft(key.slice(PREFIX.length)))
      .filter((draft): draft is Draft => !!draft && !draft.publishedCode)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function forgetPublishedDrafts(codes: string[]) {
  try {
    for (const key of Object.keys(localStorage).filter((key) => key.startsWith(PREFIX))) {
      const draft = readDraft(key.slice(PREFIX.length));
      if (draft?.publishedCode && codes.includes(draft.publishedCode)) localStorage.removeItem(key);
    }
  } catch {
    /* Browser cleanup is best effort after server deletion. */
  }
  for (const code of codes) {
    try {
      sessionStorage.removeItem(`syncspace:guest:${code}`);
    } catch {}
  }
}
