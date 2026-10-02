// src/webview/shader/scripts/presets-ui.ts
import { applyPreset, getPresetList } from "../../../scene/shader/presets";
import { postToExtension } from "../../shared/vscode-api";
import { state } from "./state";

export function mountPresetsMenu(container: HTMLElement, onApply: () => void): void {
	const presets = getPresetList();

	let html = `<div class="presets-menu">`;
	html += `<div class="presets-head">Presets</div>`;
	html += `<div class="presets-grid">`;
	for (const p of presets) {
		html += `
			<button class="preset-btn" data-preset="${p.id}" title="${esc(p.description)}">
				<span class="preset-icon">${p.icon}</span>
				<span class="preset-label">${esc(p.label)}</span>
			</button>
		`;
	}
	html += `</div></div>`;

	container.innerHTML = html;

	container.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((btn) => {
		btn.addEventListener("click", () => {
			const id = btn.dataset.preset!;
			const current = state.current;
			if (!current) return;

			const next = applyPreset(current, id);
			state.current = next;
			postToExtension({ type: "shader:update", payload: next });

			closeMenu(container);
			onApply();
		});
	});
}

export function openPresetsMenu(container: HTMLElement, onApply: () => void): void {
	mountPresetsMenu(container, onApply);
	container.classList.add("open");

	const closeOnOutside = (e: MouseEvent) => {
		if (!container.contains(e.target as Node)) {
			closeMenu(container);
			document.removeEventListener("mousedown", closeOnOutside);
		}
	};
	setTimeout(() => document.addEventListener("mousedown", closeOnOutside), 0);
}

export function closeMenu(container: HTMLElement): void {
	container.classList.remove("open");
}

function esc(s: string): string {
	return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
