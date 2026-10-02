// src/webview/inspector/scripts/bindings/reset-all-binding.ts
// ✨ جدید — Reset All binding (position=0, rotation=identity, scale=1)
import { formatNum } from "../../../shared/format";
import { Messaging } from "../messaging";
import { state } from "../state";
import { eulerToQuat } from "../utils/quaternion";

export function bindResetAll(root: HTMLElement): void {
	const btn = root.querySelector<HTMLButtonElement>("#resetAllTransform");
	if (!btn) return;

	btn.addEventListener("click", () => {
		const c = state.current;
		if (!c) return;

		// position = 0
		c.transform.position = { x: 0, y: 0, z: 0 };
		for (const ax of ["x", "y", "z"] as const) {
			Messaging.scheduleTransformUpdate({ nodeId: c.id, channel: "position", axis: ax, value: 0 });
		}

		// rotation = identity
		state.localEuler = { x: 0, y: 0, z: 0 };
		const q = eulerToQuat({ x: 0, y: 0, z: 0 });
		c.transform.rotation = { x: q.x, y: q.y, z: q.z, w: q.w };
		for (const ax of ["x", "y", "z", "w"] as const) {
			Messaging.scheduleTransformUpdate({ nodeId: c.id, channel: "rotation", axis: ax, value: (q as any)[ax] });
		}

		// scale = 1
		c.transform.scale = { x: 1, y: 1, z: 1 };
		for (const ax of ["x", "y", "z"] as const) {
			Messaging.scheduleTransformUpdate({ nodeId: c.id, channel: "scale", axis: ax, value: 1 });
		}

		Messaging.flushTransformUpdates();

		// sync UI
		for (const ch of ["position", "rotation", "scale"] as const) {
			for (const ax of ["x", "y", "z"] as const) {
				const inp = root.querySelector<HTMLInputElement>(`input[data-ch="${ch}"][data-ax="${ax}"]`);
				if (inp) inp.value = formatNum(ch === "scale" ? 1 : 0);
			}
		}
	});
}
