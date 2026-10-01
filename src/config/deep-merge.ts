export function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function deepMerge<T>(base: T, override: unknown): T {
	if (!isPlainObject(base) || !isPlainObject(override)) {
		return (override === undefined ? base : override) as T;
	}
	const out: Record<string, unknown> = { ...base };
	for (const key of Object.keys(override)) {
		const b = (base as Record<string, unknown>)[key];
		const o = (override as Record<string, unknown>)[key];
		if (isPlainObject(b) && isPlainObject(o)) {
			out[key] = deepMerge(b, o);
		} else if (o !== undefined) {
			out[key] = o;
		}
	}
	return out as T;
}
