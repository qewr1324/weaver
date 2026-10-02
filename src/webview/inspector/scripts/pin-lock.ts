// src/webview/inspector/scripts/pin-lock.ts
// ✨ جدید — Pin/Lock system (ذخیره در localStorage)
const STORAGE_KEY = "weaver.pinnedFields";

let pinned: Set<string> = new Set();
let loaded = false;

function load(): void {
	if (loaded) return;
	loaded = true;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) pinned = new Set(JSON.parse(raw));
	} catch {
		pinned = new Set();
	}
}

function save(): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify([...pinned]));
	} catch {
		/* ignore */
	}
}

export function isPinned(fieldId: string): boolean {
	load();
	return pinned.has(fieldId);
}

export function togglePin(fieldId: string): boolean {
	load();
	if (pinned.has(fieldId)) {
		pinned.delete(fieldId);
		save();
		return false;
	}
	pinned.add(fieldId);
	save();
	return true;
}

export function getPinned(): string[] {
	load();
	return [...pinned];
}
