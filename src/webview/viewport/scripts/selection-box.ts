// src/webview/viewport/scripts/selection-box.ts
// ✨ جدید — رسم bounding box دور selection (مخصوصاً multi-select)
import { scene, selectedIds, nodeIdToRoot, nodeIdToMesh } from "./state";

let boxMeshes: any[] = [];

export function clearSelectionBox(): void {
	for (const m of boxMeshes) {
		try {
			m.dispose();
		} catch {
			/* ignore */
		}
	}
	boxMeshes = [];
}

export function drawSelectionBox(): void {
	clearSelectionBox();
	if (!scene || selectedIds.length === 0) return;

	const BABYLON = (window as any).BABYLON;
	if (!BABYLON) return;

	// فقط برای multi-select نمایش بده (برای single، highlight کافیه)
	if (selectedIds.length < 2) return;

	const targets: any[] = [];
	for (const id of selectedIds) {
		const root = nodeIdToRoot.get(id);
		const mesh = nodeIdToMesh.get(id);
		const t = root || mesh;
		if (t) targets.push(t);
	}

	if (targets.length === 0) return;

	// bounding box کل
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

	if (!Number.isFinite(min.x)) return;

	const center = BABYLON.Vector3.Center(min, max);
	const size = max.subtract(min);

	// box
	const box = BABYLON.MeshBuilder.CreateBox(
		"__sel_box",
		{
			width: size.x + 0.1,
			height: size.y + 0.1,
			depth: size.z + 0.1,
		},
		scene,
	);

	box.position.copyFrom(center);
	box.isPickable = false;
	box.renderingGroupId = 1;
	box.alwaysSelectAsActiveMesh = true;

	const mat = new BABYLON.StandardMaterial("__sel_mat", scene);
	mat.wireframe = true;
	mat.emissiveColor = new BABYLON.Color3(1, 0.6, 0.15);
	mat.disableLighting = true;
	box.material = mat;

	boxMeshes.push(box);
}
