// src/webview/viewport/scripts/focus.ts
// ✨ جدید — Focus دوربین روی selection (F key یا دکمه toolbar)
import { camera, camState, selectedIds, nodeIdToRoot, nodeIdToMesh, scene } from "./state";
import { applyRotation } from "./camera";
import { setStatus } from "./look-mode";

/**
 * دوربین رو حول selection متمرکز می‌کنه.
 * - یک selection → focus روی همون
 * - چند selection → focus روی bounding box همه
 * - بدون selection → focus روی کل scene (reset)
 */
export function focusOnSelection(): void {
	if (!camera) return;
	const BABYLON = (window as any).BABYLON;
	if (!BABYLON) return;

	// جمع‌آوری mesh های انتخاب‌شده
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
		// reset view
		center = new BABYLON.Vector3(0, 0, 0);
		radius = 8;
	} else {
		// bounding box
		let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
		let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

		for (const t of targets) {
			const meshes = t.getChildMeshes ? t.getChildMeshes() : [];
			const all = [t, ...meshes];

			for (const m of all) {
				if (!m.getBoundingInfo) continue;
				const bb = m.getBoundingInfo().boundingBox;
				const wmin = bb.minimumWorld;
				const wmax = bb.maximumWorld;
				min = BABYLON.Vector3.Minimize(min, wmin);
				max = BABYLON.Vector3.Maximize(max, wmax);
			}
		}

		if (!Number.isFinite(min.x)) {
			// fallback
			center = targets[0].getAbsolutePosition();
			radius = 4;
		} else {
			center = BABYLON.Vector3.Center(min, max);
			const extents = max.subtract(min);
			radius = Math.max(extents.x, extents.y, extents.z, 1) * 0.9;
		}
	}

	// فاصله‌ی مناسب بر اساس fov
	const fov = camera.fov ?? 0.9;
	const distance = (radius / Math.tan(fov / 2)) * 1.4;

	// موقعیت جدید دوربین بر اساس direction فعلی
	const dir = camera.getDirection(BABYLON.Axis.Z).normalize();
	const newPos = center.subtract(dir.scale(distance));

	// smooth transition (اختیاری - می‌تونی حذف کنی)
	const startPos = camera.position.clone();
	const startTime = performance.now();
	const duration = 250;

	function animate() {
		const t = Math.min((performance.now() - startTime) / duration, 1);
		const e = 1 - Math.pow(1 - t, 3); // ease-out-cubic
		camera.position = BABYLON.Vector3.Lerp(startPos, newPos, e);
		applyRotation();
		if (t < 1) requestAnimationFrame(animate);
	}
	animate();

	setStatus("● Focused on " + (targets.length || "scene"), true);
}

/**
 * نصب listener برای کلید F (وقتی در look mode نیستیم).
 * ⚠️ F در look mode برای toggle look-mode استفاده می‌شه، پس conflict داریم.
 * راه‌حل: Focus با `Shift+F` یا دکمه toolbar.
 */
export function setupFocusHotkey(): void {
	window.addEventListener(
		"keydown",
		(e) => {
			// Shift+F → focus
			if (e.code === "KeyF" && e.shiftKey) {
				e.preventDefault();
				e.stopPropagation();
				focusOnSelection();
				return;
			}
			// Home → focus (universal)
			if (e.code === "Home") {
				e.preventDefault();
				focusOnSelection();
			}
		},
		{ capture: true },
	);
}
