// src/webview/inspector/scripts/main.ts
import { mustById } from "../../shared/dom";
import { bindInputs } from "./bindings";
import { Messaging } from "./messaging";
import { renderFull, updateTransformValuesOnly } from "./render";
import { setSelection, state } from "./state";

const root = mustById("root");

// ── رندر اولیه (empty) ──
renderFull(root, state, {
	onBind: () => bindInputs({ root }),
});

// ── پیام‌های ورودی از extension ──
Messaging.onMessage((msg) => {
	if (msg.type !== "inspect") return;

	const payload = msg.payload;

	// همون node → فقط مقادیر عددی رو رفرش کن
	if (state.current && payload && state.current.id === payload.id) {
		setSelection(payload, {
			multi: msg.multi || false,
			count: msg.count || 0,
			names: msg.names || [],
		});
		updateTransformValuesOnly(root, state);
		return;
	}

	// انتخاب جدید → رندر کامل
	setSelection(payload, {
		multi: msg.multi || false,
		count: msg.count || 0,
		names: msg.names || [],
	});
	renderFull(root, state, {
		onBind: () => bindInputs({ root }),
	});
});

// ── keyboard shortcuts سراسری ──
window.addEventListener("keydown", (e) => {
	if (e.target && (e.target as HTMLElement).tagName === "INPUT" && (e.target as HTMLInputElement).type !== "number") return;
	if (e.key === "Escape") {
		const active = document.activeElement as HTMLElement | null;
		if (active && active.tagName === "INPUT") active.blur();
	}
});
