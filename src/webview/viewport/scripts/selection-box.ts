// src/webview/viewport/scripts/selection-box.ts
// ✨ Selection box — ✅ fix: mesh cache، بدون create/dispose هر فریم
import { scene, selectedIds, nodeIdToRoot, nodeIdToMesh } from "./state";

let boxMesh: any = null;
let boxMat: any = null;
let lastSelectionKey = "";

export function clearSelectionBox(): void {
	if (boxMesh) {
		try {
			boxMesh.dispose();
		} catch {
			/* ignore */
		}
		boxMesh = null;
	}
	if (boxMat) {
		try {
			boxMat.dispose();
		} catch {
			/* ignore */
		}
		boxMat = null;
	}
	lastSelectionKey = "";
}

function ensureBox(): any {
	if (boxMesh && boxMat) return boxMesh;

	const BABYLON = (window as any).BABYLON;
	if (!BABYLON || !scene) return null;

	boxMesh = BABYLON.MeshBuilder.CreateBox("__sel_box", { size: 1 }, scene);
	boxMesh.isPickable = false;
	boxMesh.renderingGroupId = 1;
	boxMesh.alwaysSelectAsActiveMesh = true;
	boxMesh.isVisible = false;
	boxMesh.doNotSyncBoundingInfo = true;
	// ✅ باعث dispose نشدن geometry در rebuild نشه
	boxMesh.infiniteDistance = false;

	boxMat = new BABYLON.StandardMaterial("__sel_mat", scene);
	boxMat.wireframe = true;
	boxMat.emissiveColor = new BABYLON.Color3(1, 0.6, 0.15);
	boxMat.disableLighting = true;
	boxMat.disableDepthWrite = false;
	boxMesh.material = boxMat;

	return boxMesh;
}

export function drawSelectionBox(): void {
	if (!scene) return;

	const BABYLON = (window as any).BABYLON;
	if (!BABYLON) return;

	if (selectedIds.length < 2) {
		if (boxMesh) boxMesh.isVisible = false;
		lastSelectionKey = "";
		return;
	}

	const targets: any[] = [];
	for (const id of selectedIds) {
		const root = nodeIdToRoot.get(id);
		const mesh = nodeIdToMesh.get(id);
		const t = root || mesh;
		if (t) targets.push(t);
	}

	if (targets.length === 0) {
		if (boxMesh) boxMesh.isVisible = false;
		return;
	}

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
		if (boxMesh) boxMesh.isVisible = false;
		return;
	}

	const center = BABYLON.Vector3.Center(min, max);
	const size = max.subtract(min);

	// cache key
	const key = `${selectedIds.join(",")}:${min.x.toFixed(3)},${min.y.toFixed(3)},${min.z.toFixed(3)}:${max.x.toFixed(3)},${max.y.toFixed(3)},${max.z.toFixed(3)}`;
	if (key === lastSelectionKey) return;
	lastSelectionKey = key;

	const box = ensureBox();
	if (!box) return;

	box.position.copyFrom(center);
	box.scaling.set(size.x + 0.1, size.y + 0.1, size.z + 0.1);
	box.isVisible = true;
	box.computeWorldMatrix(true);
}
