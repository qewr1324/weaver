// src/webview/inspector/scripts/bindings/component-binding.ts
import { Messaging } from "../messaging";
import { pingLive } from "../live-sync";
import { state } from "../state";

export function bindComponentInputs(root: HTMLElement): void {
	root.querySelectorAll<HTMLInputElement>("input[data-prop], input[data-prop-num]").forEach((inp) => {
		const prop = inp.dataset.prop || inp.dataset.propNum;
		if (!prop) return;

		const isNum = inp.hasAttribute("data-prop-num");
		const isColor = inp.type === "color";

		const readValue = (): unknown => (isNum ? parseFloat(inp.value) : inp.value);

		inp.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				Messaging.updateProperty(state.current?.id, prop, readValue(), false);
				inp.blur();
			}
		});

		if (isColor || isNum) {
			let throttle: ReturnType<typeof setTimeout> | null = null;
			const send = () => {
				if (throttle) return;
				throttle = setTimeout(() => {
					throttle = null;
					Messaging.updateProperty(state.current?.id, prop, readValue(), true);
					pingLive();
				}, 32);
			};
			inp.addEventListener("input", send);
			inp.addEventListener("change", () => {
				if (throttle) {
					clearTimeout(throttle);
					throttle = null;
				}
				Messaging.updateProperty(state.current?.id, prop, readValue(), false);
			});
		}
	});
}
