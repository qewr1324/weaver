// src/webview/inspector/scripts/bindings/filter-binding.ts
import { byId, focusEnd } from "../../../shared/dom";
import { state } from "../state";

export interface FilterHooks {
	onRerender: () => void;
}

export function bindFilterInput(hooks: FilterHooks): void {
	const filterInput = byId<HTMLInputElement>("propFilter");
	if (!filterInput) return;

	filterInput.addEventListener("input", () => {
		state.propertyFilter = filterInput.value;
		hooks.onRerender();
		// بعد از re-render، focus رو برگردون
		const f = byId<HTMLInputElement>("propFilter");
		if (f) focusEnd(f);
	});
}
