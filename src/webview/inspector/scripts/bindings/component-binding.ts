// src/webview/inspector/scripts/bindings/component-binding.ts
import { Messaging } from "../messaging";
import { pingLive } from "../live-sync";
import { state } from "../state";

export function bindComponentInputs(root: HTMLElement): void {
	// ورودی‌های ساده (string, number, color)
	root.querySelectorAll<HTMLInputElement>("input[data-prop], input[data-prop-num]").forEach((inp) => {
		bindSimpleInput(inp);
	});

	// checkbox ها (bool)
	root.querySelectorAll<HTMLInputElement>("input[data-prop-bool]").forEach((inp) => {
		bindBoolInput(inp);
	});

	// vector cells
	root.querySelectorAll<HTMLInputElement>("input[data-vec-key]").forEach((inp) => {
		bindVecInput(inp, root);
	});

	// ref picker buttons (فعلاً فقط رویداد placeholder)
	root.querySelectorAll<HTMLButtonElement>("button[data-ref-pick], button[data-node-pick]").forEach((btn) => {
		btn.addEventListener("click", () => {
			const prop = btn.dataset.refPick || btn.dataset.nodePick;
			const kind = btn.dataset.refPick ? "asset" : "node";
			if (!state.current || !prop) return;
			Messaging.onMessage; // no-op برای اطمینان از import
			Messaging.updateProperty(state.current.id, `__pick__${kind}:${prop}`, null, false);
		});
	});
}

function bindSimpleInput(inp: HTMLInputElement): void {
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
}

function bindBoolInput(inp: HTMLInputElement): void {
	const prop = inp.dataset.propBool;
	if (!prop) return;

	inp.addEventListener("change", () => {
		Messaging.updateProperty(state.current?.id, prop, inp.checked, false);
		pingLive();
	});
}

function bindVecInput(inp: HTMLInputElement, root: HTMLElement): void {
	const key = inp.dataset.vecKey!;
	const axis = inp.dataset.vecAxis!;
	if (!key || !axis) return;

	inp.addEventListener("input", () => {
		const v = parseFloat(inp.value);
		if (!Number.isFinite(v)) return;
		// ساخت مقدار کامل vector
		const group = inp.closest<HTMLElement>(".vec-group");
		if (!group) return;

		const vec: Record<string, number> = {};
		group.querySelectorAll<HTMLInputElement>("input[data-vec-axis]").forEach((i) => {
			const a = i.dataset.vecAxis!;
			vec[a] = parseFloat(i.value) || 0;
		});

		Messaging.updateProperty(state.current?.id, key, vec, true);
		pingLive();
	});

	inp.addEventListener("change", () => {
		const v = parseFloat(inp.value);
		if (!Number.isFinite(v)) return;
		const group = inp.closest<HTMLElement>(".vec-group");
		if (!group) return;

		const vec: Record<string, number> = {};
		group.querySelectorAll<HTMLInputElement>("input[data-vec-axis]").forEach((i) => {
			const a = i.dataset.vecAxis!;
			vec[a] = parseFloat(i.value) || 0;
		});

		Messaging.updateProperty(state.current?.id, key, vec, false);
	});
}
