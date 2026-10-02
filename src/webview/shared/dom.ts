// src/webview/shared/dom.ts
/**
 * helperهای کوچک و بی‌طرف برای کار با DOM.
 */

export function qs<T extends Element = Element>(sel: string, root: ParentNode = document): T | null {
	return root.querySelector<T>(sel);
}

export function qsa<T extends Element = Element>(sel: string, root: ParentNode = document): T[] {
	return Array.from(root.querySelectorAll<T>(sel));
}

export function byId<T extends HTMLElement = HTMLElement>(id: string): T | null {
	return document.getElementById(id) as T | null;
}

export function mustById<T extends HTMLElement = HTMLElement>(id: string): T {
	const el = document.getElementById(id) as T | null;
	if (!el) throw new Error(`[Weaver:dom] element #${id} not found`);
	return el;
}

/**
 * تنظیم cursor روی body (برای drag).
 */
export function setBodyCursor(cursor: string): void {
	document.body.style.cursor = cursor;
}

/**
 * focus + قرار دادن caret در انتها.
 */
export function focusEnd(input: HTMLInputElement): void {
	input.focus();
	const len = input.value.length;
	try {
		input.setSelectionRange(len, len);
	} catch {
		/* بعضی input types پشتیبانی نمی‌کنن */
	}
}
