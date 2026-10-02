// src/webview/viewport/scripts/gizmo/sync.ts
import { gizmoManager, gizmoListenersAttached, nodeIdToRoot, nodeIdToMesh, setSuppressGizmoSync, selectedIds } from "../state";
import { postToExtension } from "../messaging";

function readTransform(attached: any) {
	const BABYLON = (window as any).BABYLON;
	attached.computeWorldMatrix?.(true);

	const pos = attached.getAbsolutePosition();
	const position = { x: pos.x, y: pos.y, z: pos.z };

	let rotation;
	if (attached.rotationQuaternion) {
		rotation = {
			x: attached.rotationQuaternion.x,
			y: attached.rotationQuaternion.y,
			z: attached.rotationQuaternion.z,
			w: attached.rotationQuaternion.w,
		};
	} else {
		const q = BABYLON.Quaternion.FromEulerVector(attached.rotation);
		rotation = { x: q.x, y: q.y, z: q.z, w: q.w };
	}

	const sc = attached.absoluteScaling ?? attached.scaling;
	const scale = { x: sc.x, y: sc.y, z: sc.z };

	return { position, rotation, scale };
}

function readTransformByNodeId(nodeId: string) {
	const root = nodeIdToRoot.get(nodeId);
	const mesh = nodeIdToMesh.get(nodeId);
	const target = root || mesh;
	if (!target) return null;
	return readTransform(target);
}

export function setupGizmoSync(): void {
	if (!gizmoManager) return;

	const attach = (gizmoName: string) => {
		const gizmo = gizmoManager.gizmos[gizmoName];
		if (!gizmo) return;
		if (gizmoListenersAttached.has(gizmo)) return;
		gizmoListenersAttached.add(gizmo);

		console.log("[Weaver:sync] attaching listeners to", gizmoName);

		gizmo.onDragObservable.add(() => {
			const nodeId = selectedIds[0];
			if (!nodeId) return;
			const transform = readTransformByNodeId(nodeId);
			if (!transform) return;

			postToExtension({
				type: "update:transform",
				nodeId,
				transform,
				source: "viewport",
				live: true,
			});
		});
	};

	attach("positionGizmo");
	attach("rotationGizmo");
	attach("scaleGizmo");
}

export function applyTransformFromInspector(payload: any): void {
	if (!payload) return;
	const { nodeId, transform } = payload;

	const root = nodeIdToRoot.get(nodeId);
	const pickable = nodeIdToMesh.get(nodeId);
	if (!root && !pickable) return;

	const BABYLON = (window as any).BABYLON;
	setSuppressGizmoSync(true);
	try {
		if (root) {
			if (transform.position) {
				root.position.set(transform.position.x, transform.position.y, transform.position.z);
			}
			if (transform.rotation) {
				if (!root.rotationQuaternion) {
					root.rotationQuaternion = BABYLON.Quaternion.Identity();
				}
				root.rotationQuaternion.set(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w);
			}
			if (transform.scale) {
				root.scaling.set(transform.scale.x, transform.scale.y, transform.scale.z);
			}
		}

		if (pickable && pickable !== root) {
			pickable.position.set(0, 0, 0);
			pickable.rotationQuaternion = BABYLON.Quaternion.Identity();
		}
	} finally {
		setTimeout(() => setSuppressGizmoSync(false), 0);
	}
}
