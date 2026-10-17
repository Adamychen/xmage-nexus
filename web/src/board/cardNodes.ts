export function cardNodesIn(scopes: ReadonlyArray<HTMLElement | null>): Map<string, HTMLElement> {
  const nodes = new Map<string, HTMLElement>()
  for (const scope of scopes) {
    if (!scope) continue
    scope.querySelectorAll<HTMLElement>('[data-card-id]').forEach((node) => {
      const id = node.dataset.cardId
      if (id && !nodes.has(id)) nodes.set(id, node)
    })
  }
  return nodes
}
