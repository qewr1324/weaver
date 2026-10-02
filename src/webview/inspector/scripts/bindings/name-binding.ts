// src/webview/inspector/scripts/bindings/name-binding.ts
import { byId } from "../../../shared/dom";
import { Messaging } from "../messaging";
import { state } from "../state";

export function bindNameInput(): void {
	const nameInput = byId<HTMLInputElement>("nameInput");
	if (!nameInput) return;

	nameInput.addEventListener("focus", () => {
		state.focusedFieldId = "__name__";
	});
	nameInput.addEventListener("blur", () => {
		state.focusedFieldId = null;
	});
	nameInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			nameInput.blur();
		}
	});
	nameInput.addEventListener("change", () => {
		const v = nameInput.value.trim();
		if (v === "" || !state.current || v === state.current.name) return;
		Messaging.rename(state.current.id, v);
	});
}
