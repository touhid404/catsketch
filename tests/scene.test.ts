import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeScene, elementSchema, type SceneElement } from '../packages/shared/src';
const element = (id: string, version = 1, versionNonce = 10, isDeleted = false): SceneElement => ({ id, type: 'rectangle', x: 0, y: 0, width: 100, height: 100, version, versionNonce, isDeleted });
test('independent concurrent changes both survive', () => {
  assert.deepEqual(mergeScene([element('a')], [element('b')]).map(e => e.id), ['a', 'b']);
});
test('conflicting equal-version changes converge regardless of arrival order', () => {
  const a = element('a', 2, 20), b = { ...element('a', 2, 10), x: 55 };
  assert.deepEqual(mergeScene([a], [b]), mergeScene([b], [a]));
  assert.equal(mergeScene([a], [b])[0].x, 55);
});
test('stale updates cannot resurrect a deleted element', () => {
  assert.equal(mergeScene([element('a', 3, 1, true)], [element('a', 2)])[0].isDeleted, true);
});
test('element validation rejects nonfinite coordinates and dangerous links', () => {
  assert.equal(elementSchema.safeParse({ ...element('a'), x: Infinity }).success, false);
  assert.equal(elementSchema.safeParse({ ...element('a'), link: 'javascript:alert(1)' }).success, false);
});
