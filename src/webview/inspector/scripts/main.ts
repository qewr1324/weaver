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
	const isSameNode = state.current && payload && state.current.id === payload.id;

	if (isSameNode) {
		// ⭐ فیلد در حال focus رو با state محلی preserve کن تا caret/تایپ پرش نکنه
		const activeEl = document.activeElement as HTMLInputElement | null;
		const activeCh = activeEl?.dataset?.ch;
		const activeAx = activeEl?.dataset?.ax;

		const merged = { ...payload };
		if (activeCh && activeAx && activeEl?.matches("input[data-ch]")) {
			(merged.transform as any)[activeCh][activeAx] = (state.current!.transform as any)[activeCh][activeAx];
		}

		setSelection(merged, {
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
