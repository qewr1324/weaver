// src/webview/viewport/scripts/gizmo/sync.ts
import { gizmoManager, meshToNodeId, rootToNodeId, gizmoListenersAttached, suppressGizmoSync, nodeIdToRoot, nodeIdToMesh, setSuppressGizmoSync } from "../state";
import { postToExtension } from "../messaging";

function postTransform(attached: any, live: boolean): void {
	if (suppressGizmoSync) return;
	const nodeId = meshToNodeId.get(attached) || rootToNodeId.get(attached);
	if (!nodeId) return;
	const BABYLON = (window as any).BABYLON;
	const worldPos = attached.getAbsolutePosition();
	const worldScale = attached.absoluteScaling || attached.scaling;
	const q = attached.rotationQuaternion || BABYLON.Quaternion.FromEulerVector(attached.rotation);

	postToExtension({
		type: "update:transform",
		nodeId,
		transform: {
			position: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
			rotation: { x: q.x, y: q.y, z: q.z, w: q.w },
			scale: { x: worldScale.x, y: worldScale.y, z: worldScale.z },
		},
		source: "viewport",
		live,
	});
}

export function setupGizmoSync(): void {
	if (!gizmoManager) return;

	const attach = (gizmoName: string) => {
		const gizmo = gizmoManager.gizmos[gizmoName];
		if (!gizmo) return;
		// ⭐ اگه قبلاً listener بستیم، دوباره نبند
		if (gizmoListenersAttached.has(gizmo)) return;
		gizmoListenersAttached.add(gizmo);

		let dragThrottle: ReturnType<typeof setTimeout> | null = null;
		gizmo.onDragObservable.add(() => {
			if (dragThrottle) return;
			dragThrottle = setTimeout(() => {
				dragThrottle = null;
				const target = gizmo.attachedNode || gizmoManager.attachedMesh;
				if (target) postTransform(target, true);
			}, 16);
		});

		gizmo.onDragEndObservable.add(() => {
			if (dragThrottle) {
				clearTimeout(dragThrottle);
				dragThrottle = null;
			}
			const target = gizmo.attachedNode || gizmoManager.attachedMesh;
			if (target) postTransform(target, false);
		});

		console.log("[Weaver] gizmoSync attached:", gizmoName);
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
				root.rotationQuaternion = new BABYLON.Quaternion(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w);
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
