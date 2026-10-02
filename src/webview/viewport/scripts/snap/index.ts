// src/webview/viewport/scripts/snap/index.ts
import { editor, scene, selectedIds, gizmoManager, nodeIdToRoot, nodeIdToMesh, meshToNodeId, dom } from "../state";
import { getConfig } from "../config";
import { setStatus } from "../look-mode";

export function toggleSnapGrid(): void {
	editor.snapGrid = !editor.snapGrid;
	const btn = dom.snapGroup.querySelector('[data-snap="grid"]');
	if (btn) btn.classList.toggle("active", editor.snapGrid);
	setStatus("● Snap Grid: " + (editor.snapGrid ? "ON (" + editor.snapGridSize + ")" : "OFF"), true);
}

export function toggleSnapObject(): void {
	editor.snapObject = !editor.snapObject;
	const btn = dom.snapGroup.querySelector('[data-snap="object"]');
	if (btn) btn.classList.toggle("active", editor.snapObject);
	setStatus("● Snap Object: " + (editor.snapObject ? "ON" : "OFF"), true);
}

export function applySnap(): void {
	const mesh = selectedIds[0] ? nodeIdToRoot.get(selectedIds[0]) || nodeIdToMesh.get(selectedIds[0]) : null;
	if (!mesh) return;

	const gizmoActive =
		gizmoManager && (gizmoManager.gizmos.positionGizmo?.isHovered || gizmoManager.gizmos.positionGizmo?.isDragging || gizmoManager.gizmos.rotationGizmo?.isHovered || gizmoManager.gizmos.rotationGizmo?.isDragging || gizmoManager.gizmos.scaleGizmo?.isHovered || gizmoManager.gizmos.scaleGizmo?.isDragging);
	if (!gizmoActive) return;

	const BABYLON = (window as any).BABYLON;

	if (editor.snapGrid) {
		const g = editor.snapGridSize;
		mesh.position.x = Math.round(mesh.position.x / g) * g;
		mesh.position.y = Math.round(mesh.position.y / g) * g;
		mesh.position.z = Math.round(mesh.position.z / g) * g;
	}

	if (editor.snapObject) {
		const cfg = getConfig();
		const threshold = (cfg as any)?.toolbar?.snap?.object?.threshold ?? 0.3;
		for (const other of scene.meshes) {
			if (other === mesh) continue;
			if (other.name === "__grid") continue;
			if (!meshToNodeId.has(other)) continue;
			const d = BABYLON.Vector3.Distance(mesh.position, other.position);
			if (d < threshold) {
				mesh.position.copyFrom(other.position);
				break;
			}
		}
	}
}
