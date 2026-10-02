// src/webview/inspector/scripts/context-menu.ts
// ✨ جدید — Mini context menu برای input ها (Copy/Paste/Reset)
import { formatNum } from "../../shared/format";
import { Messaging } from "./messaging";
import { state } from "./state";

let menuEl: HTMLDivElement | null = null;

interface MenuItem {
	label: string;
	action: () => void;
	danger?: boolean;
}

function ensureMenu(): HTMLDivElement {
	if (menuEl) return menuEl;
	menuEl = document.createElement("div");
	menuEl.className = "wv-ctx-menu";
	menuEl.style.display = "none";
	document.body.appendChild(menuEl);
	return menuEl;
}

function hideMenu(): void {
	if (menuEl) menuEl.style.display = "none";
}

function showMenu(x: number, y: number, items: MenuItem[]): void {
	const el = ensureMenu();
	el.innerHTML = "";
	for (const it of items) {
		const row = document.createElement("div");
		row.className = "wv-ctx-item" + (it.danger ? " danger" : "");
		row.textContent = it.label;
		row.addEventListener("click", (e) => {
			e.stopPropagation();
			hideMenu();
			it.action();
		});
		el.appendChild(row);
	}
	el.style.display = "block";
	el.style.left = `${x}px`;
	el.style.top = `${y}px`;

	// clamp
	const rect = el.getBoundingClientRect();
	if (rect.right > window.innerWidth) el.style.left = `${window.innerWidth - rect.width - 4}px`;
	if (rect.bottom > window.innerHeight) el.style.top = `${window.innerHeight - rect.height - 4}px`;
}

export function installContextMenu(root: HTMLElement): void {
	// global hide
	document.addEventListener("click", hideMenu);
	document.addEventListener("scroll", hideMenu, true);
	window.addEventListener("blur", hideMenu);

	root.addEventListener("contextmenu", (e) => {
		const target = e.target as HTMLElement;
		const inp = target.closest<HTMLInputElement>("input[data-ch], input[data-prop], input[data-prop-num]");
		if (!inp) return;
		e.preventDefault();

		const isTransform = inp.hasAttribute("data-ch");
		const ch = inp.dataset.ch;
		const ax = inp.dataset.ax;
		const prop = inp.dataset.prop || inp.dataset.propNum;

		const items: MenuItem[] = [
			{
				label: "Copy Value",
				action: () => {
					navigator.clipboard.writeText(inp.value).catch(() => {});
				},
			},
			{
				label: "Paste Value",
				action: async () => {
					try {
						const txt = await navigator.clipboard.readText();
						const num = parseFloat(txt);
						if (!Number.isFinite(num)) return;
						inp.value = formatNum(num);
						inp.dispatchEvent(new Event("input", { bubbles: true }));
						inp.dispatchEvent(new Event("change", { bubbles: true }));
					} catch {
						/* ignore */
					}
				},
			},
			{ label: "—", action: () => {} },
			{
				label: "Reset to Default",
				action: () => {
					if (isTransform) {
						const def = ch === "scale" ? 1 : 0;
						inp.value = formatNum(def);
						inp.dispatchEvent(new Event("input", { bubbles: true }));
						Messaging.flushTransformUpdates();
					} else if (state.current) {
						Messaging.updateProperty(state.current.id, prop!, 0, false);
					}
				},
			},
			{
				label: "Copy Full Vector",
				action: () => {
					if (!state.current || !isTransform) return;
					const v = (state.current.transform as any)[ch!];
					navigator.clipboard.writeText(JSON.stringify(v)).catch(() => {});
				},
			},
		];

		// حذف آیتم های بی ربط
		if (!isTransform) {
			items.splice(3, 1); // Copy Full Vector
		}

		showMenu(e.clientX, e.clientY, items);
	});
}
