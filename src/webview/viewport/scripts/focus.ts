// src/webview/viewport/scripts/focus.ts
// ✨ Focus/Framing — ✅ fix: نصب فقط یک بار + دکمه toolbar
import { camera, camState, selectedIds, nodeIdToRoot, nodeIdToMesh, scene } from "./state";
import { applyRotation } from "./camera";
import { setStatus } from "./look-mode";

export function focusOnSelection(): void {
	if (!camera) return;
	const BABYLON = (window as any).BABYLON;
	if (!BABYLON) return;

	const targets: any[] = [];
	for (const id of selectedIds) {
		const root = nodeIdToRoot.get(id);
		const mesh = nodeIdToMesh.get(id);
		const t = root || mesh;
		if (t) targets.push(t);
	}

	let center: any;
	let radius: number;

	if (targets.length === 0) {
		center = new BABYLON.Vector3(0, 0, 0);
		radius = 8;
	} else {
		let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
		let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

		for (const t of targets) {
			const meshes = t.getChildMeshes ? t.getChildMeshes() : [];
			const all = [t, ...meshes];

			for (const m of all) {
				if (!m.getBoundingInfo) continue;
				const bb = m.getBoundingInfo().boundingBox;
				min = BABYLON.Vector3.Minimize(min, bb.minimumWorld);
				max = BABYLON.Vector3.Maximize(max, bb.maximumWorld);
			}
		}

		if (!Number.isFinite(min.x)) {
			center = targets[0].getAbsolutePosition();
			radius = 4;
		} else {
			center = BABYLON.Vector3.Center(min, max);
			const extents = max.subtract(min);
			radius = Math.max(extents.x, extents.y, extents.z, 1) * 0.9;
		}
	}

	const fov = camera.fov ?? 0.9;
	const distance = (radius / Math.tan(fov / 2)) * 1.4;

	const dir = camera.getDirection(BABYLON.Axis.Z).normalize();
	const newPos = center.subtract(dir.scale(distance));

	const startPos = camera.position.clone();
	const startTime = performance.now();
	const duration = 250;

	function animate() {
		const t = Math.min((performance.now() - startTime) / duration, 1);
		const e = 1 - Math.pow(1 - t, 3);
		camera.position = BABYLON.Vector3.Lerp(startPos, newPos, e);
		applyRotation();
		if (t < 1) requestAnimationFrame(animate);
	}
	animate();

	setStatus("● Focused on " + (targets.length || "scene"), true);
}

let installed = false;

export function setupFocusHotkey(): void {
	if (installed) return;
	installed = true;

	window.addEventListener(
		"keydown",
		(e) => {
			if (e.code === "KeyF" && e.shiftKey) {
				e.preventDefault();
				e.stopPropagation();
				focusOnSelection();
				return;
			}
			if (e.code === "Home") {
				e.preventDefault();
				focusOnSelection();
			}
		},
		{ capture: true },
	);

	// ✅ اتصال دکمه‌ی toolbar (اگه وجود داشت)
	window.addEventListener("load", () => {
		setTimeout(() => {
			const btn = document.getElementById("focusBtn");
			if (btn) {
				btn.addEventListener("click", () => focusOnSelection());
			}
		}, 100);
	});
}
