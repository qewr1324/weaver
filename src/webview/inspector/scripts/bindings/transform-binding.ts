// src/webview/inspector/scripts/bindings/transform-binding.ts
import { formatNum } from "../../../shared/format";
import { setBodyCursor } from "../../../shared/dom";
import { Messaging } from "../messaging";
import { state } from "../state";

export function bindTransformInputs(root: HTMLElement): void {
	bindNumericInputs(root);
	bindDragLabels(root);
	bindResetButtons(root);
}

function bindNumericInputs(root: HTMLElement): void {
	root.querySelectorAll<HTMLInputElement>("input[data-ch]").forEach((inp) => {
		const fid = `${inp.dataset.ch}.${inp.dataset.ax}`;

		if (state.focusedFieldId === fid) {
			inp.focus();
			const len = inp.value.length;
			inp.setSelectionRange(len, len);
		}

		inp.addEventListener("focus", () => {
			state.focusedFieldId = fid;
		});
		inp.addEventListener("blur", () => {
			state.focusedFieldId = null;
		});

		inp.addEventListener("input", () => {
			const raw = inp.value.trim();
			if (raw === "" || raw === "-" || raw === "." || raw === "-.") return;
			const parsed = parseFloat(raw);
			if (!Number.isFinite(parsed)) return;
			if (state.current) {
				(state.current.transform as any)[inp.dataset.ch!][inp.dataset.ax!] = parsed;
			}
			if (!state.current) return;
			Messaging.scheduleTransformUpdate({
				nodeId: state.current.id,
				channel: inp.dataset.ch!,
				axis: inp.dataset.ax!,
				value: parsed,
			});
		});

		inp.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				Messaging.flushTransformUpdates();
				inp.blur();
			}
			if (e.key === "Escape") {
				e.preventDefault();
				if (state.current) {
					inp.value = formatNum((state.current.transform as any)[inp.dataset.ch!][inp.dataset.ax!]);
				}
				inp.blur();
			}
			if (e.key === "ArrowUp" || e.key === "ArrowDown") {
				const step = e.shiftKey ? 1 : e.ctrlKey || e.metaKey ? 0.01 : 0.1;
				const dir = e.key === "ArrowUp" ? 1 : -1;
				const cur = parseFloat(inp.value) || 0;
				const next = +(cur + dir * step).toFixed(6);
				inp.value = formatNum(next);
				inp.dispatchEvent(new Event("input", { bubbles: true }));
				e.preventDefault();
			}
		});
	});
}

function bindDragLabels(root: HTMLElement): void {
	root.querySelectorAll<HTMLLabelElement>("label[data-drag]").forEach((lbl) => {
		let dragging = false;
		let startX = 0;
		let startVal = 0;
		const step = parseFloat(lbl.dataset.step || "0.1");

		lbl.addEventListener("mousedown", (e) => {
			e.preventDefault();
			dragging = true;
			startX = e.clientX;
			const [ch, ax] = lbl.dataset.drag!.split(".");
			startVal = state.current ? (state.current.transform as any)[ch][ax] || 0 : 0;
			setBodyCursor("ew-resize");
		});

		const move = (e: MouseEvent) => {
			if (!dragging) return;
			const [ch, ax] = lbl.dataset.drag!.split(".");
			const dx = e.clientX - startX;
			const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
			const next = +(startVal + dx * step * mult).toFixed(4);
			const inp = root.querySelector<HTMLInputElement>(`input[data-ch="${ch}"][data-ax="${ax}"]`);
			if (inp) {
				inp.value = formatNum(next);
				inp.dispatchEvent(new Event("input", { bubbles: true }));
			}
		};

		const up = () => {
			if (!dragging) return;
			dragging = false;
			setBodyCursor("");
			Messaging.flushTransformUpdates();
		};

		window.addEventListener("mousemove", move);
		window.addEventListener("mouseup", up);
	});
}

function bindResetButtons(root: HTMLElement): void {
	root.querySelectorAll<HTMLLabelElement>("label[data-reset]").forEach((btn) => {
		btn.addEventListener("click", () => {
			const [ch, ax] = btn.dataset.reset!.split(".");
			const def = parseFloat(btn.dataset.default || "0");
			const inp = root.querySelector<HTMLInputElement>(`input[data-ch="${ch}"][data-ax="${ax}"]`);
			if (inp) {
				inp.value = formatNum(def);
				inp.dispatchEvent(new Event("input", { bubbles: true }));
				Messaging.flushTransformUpdates();
			}
		});
	});
}
