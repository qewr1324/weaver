// src/webview/inspector/scripts/bindings/transform-binding.ts
import { formatNum } from "../../../shared/format";
import { setBodyCursor } from "../../../shared/dom";
import { isPinned, togglePin } from "../pin-lock";
import { Messaging } from "../messaging";
import { state } from "../state";
import { eulerToQuat } from "../utils/quaternion";

export function bindTransformInputs(root: HTMLElement): void {
	bindPinButtons(root);
	bindNumericInputs(root);
	bindDragLabels(root);
	bindResetButtons(root);
}

function bindPinButtons(root: HTMLElement): void {
	root.querySelectorAll<HTMLLabelElement>("label[data-pin]").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			const fieldId = btn.dataset.pin!;
			const nowPinned = togglePin(fieldId);

			// آپدیت UI
			btn.textContent = nowPinned ? "📌" : "○";
			btn.classList.toggle("pinned", nowPinned);
			btn.title = nowPinned ? "Unpin" : "Pin this field";

			const row = btn.closest<HTMLElement>(".row");
			row?.classList.toggle("pinned-row", nowPinned);
		});
	});
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
			if (!state.current) return;

			const ch = inp.dataset.ch!;
			const ax = inp.dataset.ax!;

			if (ch === "rotation") {
				(state.localEuler as any)[ax] = parsed;
				const q = eulerToQuat(state.localEuler);
				state.current.transform.rotation = { x: q.x, y: q.y, z: q.z, w: q.w };

				for (const a of ["x", "y", "z", "w"] as const) {
					Messaging.scheduleTransformUpdate({
						nodeId: state.current.id,
						channel: "rotation",
						axis: a,
						value: (q as any)[a],
					});
				}
			} else {
				(state.current.transform as any)[ch][ax] = parsed;
				Messaging.scheduleTransformUpdate({
					nodeId: state.current.id,
					channel: ch,
					axis: ax,
					value: parsed,
				});
			}
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
					if (inp.dataset.ch === "rotation") {
						inp.value = formatNum((state.localEuler as any)[inp.dataset.ax!]);
					} else {
						inp.value = formatNum((state.current.transform as any)[inp.dataset.ch!][inp.dataset.ax!]);
					}
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
			const fieldId = lbl.dataset.drag!;

			// اگه pinned باشه، drag غیرفعاله
			if (isPinned(fieldId)) return;

			dragging = true;
			startX = e.clientX;
			const [ch, ax] = fieldId.split(".");

			if (!state.current) {
				startVal = 0;
			} else if (ch === "rotation") {
				startVal = (state.localEuler as any)[ax] || 0;
			} else {
				startVal = (state.current.transform as any)[ch][ax] || 0;
			}

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

			if (ch === "rotation") {
				if (!state.current) return;
				state.localEuler.x = 0;
				state.localEuler.y = 0;
				state.localEuler.z = 0;

				const q = eulerToQuat({ x: 0, y: 0, z: 0 });
				state.current.transform.rotation = { x: q.x, y: q.y, z: q.z, w: q.w };

				for (const a of ["x", "y", "z", "w"] as const) {
					Messaging.scheduleTransformUpdate({
						nodeId: state.current.id,
						channel: "rotation",
						axis: a,
						value: (q as any)[a],
					});
				}
				Messaging.flushTransformUpdates();

				for (const a of ["x", "y", "z"]) {
					const i = root.querySelector<HTMLInputElement>(`input[data-ch="rotation"][data-ax="${a}"]`);
					if (i) i.value = formatNum(0);
				}
				return;
			}

			const inp = root.querySelector<HTMLInputElement>(`input[data-ch="${ch}"][data-ax="${ax}"]`);
			if (inp) {
				inp.value = formatNum(def);
				inp.dispatchEvent(new Event("input", { bubbles: true }));
				Messaging.flushTransformUpdates();
			}
		});
	});
}
