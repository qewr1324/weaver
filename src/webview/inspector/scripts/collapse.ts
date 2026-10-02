// src/webview/inspector/scripts/collapse.ts
// ✨ جدید — Collapse state management (localStorage)
const KEY = "weaver.collapsed";

let cache: Set<string> | null = null;

function load(): Set<string> {
	if (cache) return cache;
	try {
		const raw = localStorage.getItem(KEY);
		cache = new Set(raw ? JSON.parse(raw) : []);
	} catch {
		cache = new Set();
	}
	return cache;
}

function save(): void {
	if (!cache) return;
	try {
		localStorage.setItem(KEY, JSON.stringify([...cache]));
	} catch {
		/* ignore */
	}
}

export function isCollapsed(id: string): boolean {
	return load().has(id);
}

export function toggleCollapsed(id: string): boolean {
	const s = load();
	const now = s.has(id);
	if (now) s.delete(id);
	else s.add(id);
	save();
	return !now;
}

export function installCollapse(root: HTMLElement): void {
	root.addEventListener("click", (e) => {
		const head = (e.target as HTMLElement).closest<HTMLElement>(".comp-head[data-comp-id]");
		if (!head) return;
		// اگه روی دکمه های داخل head کلیک شده، ignore کن
		if ((e.target as HTMLElement).closest("button, input, select")) return;

		const id = head.dataset.compId!;
		toggleCollapsed(id);
		const comp = head.closest<HTMLElement>(".comp");
		if (comp) comp.classList.toggle("collapsed", isCollapsed(id));
	});
}

export function applyCollapseState(root: HTMLElement): void {
	root.querySelectorAll<HTMLElement>(".comp[data-comp]").forEach((comp) => {
		const head = comp.querySelector<HTMLElement>(".comp-head");
		const id = comp.dataset.comp || head?.textContent?.trim() || "";
		if (!id) return;
		head?.setAttribute("data-comp-id", id);
		comp.classList.toggle("collapsed", isCollapsed(id));
	});
}
