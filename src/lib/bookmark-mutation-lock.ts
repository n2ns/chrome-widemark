let fallbackQueue: Promise<unknown> = Promise.resolve();

/**
 * Serialize bookmark mutations across every Side Panel belonging to this
 * extension origin. Chrome 116 supports the Web Locks API; the promise queue
 * keeps tests and unusual fallback environments deterministic as well.
 */
export function withGlobalBookmarkMutation<T>(task: () => Promise<T>): Promise<T> {
  if (navigator.locks) {
    return navigator.locks.request('widemark:bookmark-mutation', { mode: 'exclusive' }, task);
  }
  const result = fallbackQueue.then(task, task);
  fallbackQueue = result.then(() => undefined, () => undefined);
  return result;
}

/** Hold a shared snapshot lock while a long-running bookmark read completes. */
export function withGlobalBookmarkRead<T>(task: () => Promise<T>): Promise<T> {
  if (navigator.locks) {
    return navigator.locks.request('widemark:bookmark-mutation', { mode: 'shared' }, task);
  }
  // The fallback cannot coordinate modes, so serialize reads conservatively.
  const result = fallbackQueue.then(task, task);
  fallbackQueue = result.then(() => undefined, () => undefined);
  return result;
}
