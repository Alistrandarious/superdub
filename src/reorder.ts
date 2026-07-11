// Pure list-reorder helpers, shared by the drag interaction and the commit step.

// Move the item at `from` to `to`, returning a new array.
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

// Rebuild the full ordered list after one cadence group was reordered: walk the
// original order and, at each slot held by a group member, drop in the next name
// from newGroupOrder. Non-members keep their exact positions, so groups stay
// interleaved as before. (newGroupOrder must be a permutation of the group's
// members that appear in `all`.)
export function applyGroupReorder(all: string[], newGroupOrder: string[]): string[] {
  const groupSet = new Set(newGroupOrder);
  let gi = 0;
  return all.map(h => (groupSet.has(h) ? newGroupOrder[gi++] : h));
}
