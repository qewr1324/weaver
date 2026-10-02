// src/webview/viewport/scripts/transform-commit.ts
// ✨ ماژول مستقل برای commit کردن transform بعد از drag
// gizmo/sync.ts فقط live:true می‌فرسته. این ماژول drag end رو تشخیص میده و live:false می‌فرسته.

import { gizmoManager, selectedIds, nodeIdToRoot, nodeIdToMesh, scene } from "./state";
import { postToExtension } from "./messaging";

let installed = false;
let wasDragging = false;
let beforeTransform: any = null;

function readTransform(nodeId: string) {
	const root = nodeIdToRoot.get(nodeId);
	const mesh = nodeIdToMesh.get(nodeId);
	const target = root || mesh;
	if (!target) return null;

	const BABYLON = (window as any).BABYLON;
	target.computeWorldMatrix?.(true);

	const pos = target.getAbsolutePosition();
	const position = { x: pos.x, y: pos.y, z: pos.z };

	let rotation;
	if (target.rotationQuaternion) {
		rotation = {
			x: target.rotationQuaternion.x,
			y: target.rotationQuaternion.y,
			z: target.rotationQuaternion.z,
			w: target.rotationQuaternion.w,
		};
	} else {
		const q = BABYLON.Quaternion.FromEulerVector(target.rotation);
		rotation = { x: q.x, y: q.y, z: q.z, w: q.w };
	}

	const sc = target.absoluteScaling ?? target.scaling;
	const scale = { x: sc.x, y: sc.y, z: sc.z };

	return { position, rotation, scale };
}

export function installTransformCommit(): void {
	if (installed) return;
	installed = true;
	if (!scene) return;

	scene.onBeforeRenderObservable.add(() => {
		if (!gizmoManager) return;

		const nodeId = selectedIds[0];
		if (!nodeId) {
			wasDragging = false;
			beforeTransform = null;
			return;
		}

		const isDragging = !!(gizmoManager.gizmos.positionGizmo?.isDragging || gizmoManager.gizmos.rotationGizmo?.isDragging || gizmoManager.gizmos.scaleGizmo?.isDragging);

		// شروع drag
		if (isDragging && !wasDragging) {
			wasDragging = true;
			beforeTransform = readTransform(nodeId);
			console.log("[Weaver:commit] drag start → saved before");
		}

		// پایان drag
		if (!isDragging && wasDragging) {
			wasDragging = false;
			const after = readTransform(nodeId);
			if (after && beforeTransform) {
				console.log("[Weaver:commit] drag end → commit");
				postToExtension({
					type: "update:transform",
					nodeId,
					transform: after,
					before: beforeTransform,
					source: "viewport",
					live: false,
				});
			}
			beforeTransform = null;
		}
	});

	console.log("[Weaver:undo-redo] transform-commit installed");
}
