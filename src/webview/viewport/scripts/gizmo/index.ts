// src/webview/viewport/scripts/gizmo/index.ts
// ✨ Gizmo — ✅ fix: applyGizmoMode idempotent (no rebuild if mode unchanged)
import { gizmoManager, selectedIds, nodeIdToRoot, nodeIdToMesh, editor, setGizmoManager, dom } from "../state";
import { getConfig } from "../config";
import { setActiveInGroup } from "../toolbar/buttons";
import { setStatus } from "../look-mode";
import { setupGizmoSync } from "./sync";

export function setupGizmo(): void {
	const BABYLON = (window as any).BABYLON;
	const scene = (window as any).__weaver_scene;
	if (!scene) return;

	const manager = new BABYLON.GizmoManager(scene);
	manager.usePointerToAttachGizmos = false;
	manager.positionGizmoEnabled = true;
	manager.rotationGizmoEnabled = false;
	manager.scaleGizmoEnabled = false;
	manager.boundingBoxGizmoEnabled = false;

	const ratio = getConfig()?.gizmo.scaleRatio ?? 1.0;
	if (manager.gizmos.positionGizmo) {
		manager.gizmos.positionGizmo.updateGizmoRotationToMatchAttachedMesh = false;
		manager.gizmos.positionGizmo.updateGizmoPositionToMatchAttachedMesh = true;
		manager.gizmos.positionGizmo.scaleRatio = ratio;
	}
	if (manager.gizmos.rotationGizmo) manager.gizmos.rotationGizmo.scaleRatio = ratio;
	if (manager.gizmos.scaleGizmo) manager.gizmos.scaleGizmo.scaleRatio = ratio;

	setGizmoManager(manager);
}

// ✅ state cache — که بدونیم آخرین بار چی set کردیم
let lastMode: "move" | "rotate" | "scale" | null = null;
let lastTargetId: string | null = null;
let lastRefMode: "world" | "object" | null = null;

/**
 * ✅ نسخه‌ی idempotent از applyGizmoMode.
 * اگه mode/target/refMode عوض نشده، هیچ کاری نمی‌کنه.
 */
export function applyGizmoMode(): void {
	if (!gizmoManager) return;

	const mode = editor.transformMode;
	const targetId = selectedIds[0] ?? null;
	const target = targetId ? nodeIdToRoot.get(targetId) || nodeIdToMesh.get(targetId) : null;
	const refMode = editor.referenceMode;

	// ✅ اگه هیچی عوض نشده → خروج
	if (lastMode === mode && lastTargetId === targetId && lastRefMode === refMode) {
		return;
	}

	// ✅ آپدیت cache
	lastMode = mode;
	lastTargetId = targetId;
	lastRefMode = refMode;

	// ✅ فقط وقتی mode عوض شده، gizmo enabled رو دست بزن
	gizmoManager.positionGizmoEnabled = false;
	gizmoManager.rotationGizmoEnabled = false;
	gizmoManager.scaleGizmoEnabled = false;

	if (gizmoManager.gizmos.positionGizmo) {
		gizmoManager.gizmos.positionGizmo.attachedNode = null;
	}
	if (gizmoManager.gizmos.rotationGizmo) {
		gizmoManager.gizmos.rotationGizmo.attachedNode = null;
	}
	if (gizmoManager.gizmos.scaleGizmo) {
		gizmoManager.gizmos.scaleGizmo.attachedNode = null;
	}

	if (mode === "move") gizmoManager.positionGizmoEnabled = true;
	else if (mode === "rotate") gizmoManager.rotationGizmoEnabled = true;
	else if (mode === "scale") gizmoManager.scaleGizmoEnabled = true;

	const matchObj = refMode === "object";

	if (mode === "move" && gizmoManager.gizmos.positionGizmo) {
		gizmoManager.gizmos.positionGizmo.updateGizmoRotationToMatchAttachedMesh = matchObj;
		gizmoManager.gizmos.positionGizmo.updateGizmoPositionToMatchAttachedMesh = true;
	}
	if (mode === "rotate" && gizmoManager.gizmos.rotationGizmo) {
		gizmoManager.gizmos.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = matchObj;
	}

	if (target) {
		if (target.getClassName && target.getClassName() === "TransformNode") {
			if (mode === "move" && gizmoManager.gizmos.positionGizmo) {
				gizmoManager.gizmos.positionGizmo.attachedNode = target;
			}
			if (mode === "rotate" && gizmoManager.gizmos.rotationGizmo) {
				gizmoManager.gizmos.rotationGizmo.attachedNode = target;
			}
			if (mode === "scale" && gizmoManager.gizmos.scaleGizmo) {
				gizmoManager.gizmos.scaleGizmo.attachedNode = target;
			}
		} else {
			gizmoManager.attachToMesh(target);
		}
	}
}

export function setTransformMode(mode: "move" | "rotate" | "scale"): void {
	editor.transformMode = mode;
	if (!gizmoManager) return;

	setupGizmoSync();
	applyGizmoMode();

	setActiveInGroup(dom.transformGroup, mode);
	setStatus("● Transform: " + mode, true);
}

export function attachGizmoTo(_nodeId: string): void {
	applyGizmoMode();
}

export function detachGizmo(): void {
	if (!gizmoManager) return;
	if (gizmoManager.gizmos.positionGizmo) gizmoManager.gizmos.positionGizmo.attachedNode = null;
	if (gizmoManager.gizmos.rotationGizmo) gizmoManager.gizmos.rotationGizmo.attachedNode = null;
	if (gizmoManager.gizmos.scaleGizmo) gizmoManager.gizmos.scaleGizmo.attachedNode = null;

	// ✅ reset cache
	lastMode = null;
	lastTargetId = null;
	lastRefMode = null;
}
