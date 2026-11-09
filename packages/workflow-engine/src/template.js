function lookup(path, context) {
  if (!path) return undefined;
  return path.split('.').reduce((value, part) => value == null ? undefined : value[part], context);
}

export function resolveTemplates(value, context) {
  if (typeof value === 'string') {
    const exact = value.match(/^\{\{([^{}]+)\}\}$/);
    if (exact) return lookup(exact[1].trim(), context);
    return value.replace(/\{\{([^{}]+)\}\}/g, (_match, path) => {
      const result = lookup(path.trim(), context);
      return result == null ? '' : String(result);
    });
  }
  if (Array.isArray(value)) return value.map((item) => resolveTemplates(item, context));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveTemplates(item, context)]));
  }
  return value;
}
