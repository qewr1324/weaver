// src/webview/inspector/scripts/enabled-toggle.ts
// ✨ جدید — Toggle enabled برای component ها
import { Messaging } from "./messaging";
import { state } from "./state";

export function installEnabledToggle(root: HTMLElement): void {
	root.addEventListener("change", (e) => {
		const cb = (e.target as HTMLElement).closest<HTMLInputElement>("input[data-comp-enabled]");
		if (!cb) return;
		const compType = cb.dataset.compEnabled!;
		const enabled = cb.checked;
		if (!state.current) return;
		Messaging.updateProperty(state.current.id, `${compType}.__enabled`, enabled, false);
	});
}

/**
 * این تابع رو بعد از render صدا بزن تا checkbox ها ساخته بشن.
 */
export function injectEnabledToggle(root: HTMLElement): void {
	if (!state.current) return;
	root.querySelectorAll<HTMLElement>(".comp[data-comp]").forEach((comp) => {
		const head = comp.querySelector<HTMLElement>(".comp-head");
		if (!head || head.querySelector("input[data-comp-enabled]")) return;
		const type = comp.dataset.comp!;
		const enabledVal = (state.current!.components.find((c) => c.type === type) as any)?.enabled;
		const isEnabled = enabledVal !== false;

		const wrap = document.createElement("label");
		wrap.className = "comp-enabled-wrap";
		wrap.title = isEnabled ? "Disable component" : "Enable component";
		wrap.innerHTML = `<input type="checkbox" data-comp-enabled="${type}" ${isEnabled ? "checked" : ""}/>`;
		head.insertBefore(wrap, head.firstChild);
	});
}
