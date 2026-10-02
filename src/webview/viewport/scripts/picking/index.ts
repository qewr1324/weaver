// src/webview/viewport/scripts/picking/index.ts
import { scene, dom, lookState, selectedIds, hoveredMesh, meshToNodeId, setSelectedIds, setHoveredMesh } from "../state";
import { refreshHighlights } from "../highlighting";
import { applyGizmoMode } from "../gizmo";
import { postToExtension } from "../messaging";

export function applySelection(ids: string[]): void {
	setSelectedIds(ids || []);
	if (!scene) return;
	refreshHighlights();
	applyGizmoMode();
}

export function setupPicking(): void {
	if (!scene) return;

	// hover
	scene.onPointerObservable.add((pi: any) => {
		const BABYLON = (window as any).BABYLON;
		if (pi.type !== BABYLON.PointerEventTypes.POINTERMOVE) return;
		if (!scene) return;
		if (lookState.active) return;

		const pick = scene.pick(scene.pointerX, scene.pointerY, (m: any) => {
			if (!m || !m.isPickable) return false;
			if (m.name === "__grid") return false;
			if (!meshToNodeId.has(m)) return false;
			return true;
		});

		const newHover = pick && pick.hit && pick.pickedMesh ? pick.pickedMesh : null;

		if (newHover !== hoveredMesh) {
			setHoveredMesh(newHover);
			refreshHighlights();
			dom.canvas.style.cursor = hoveredMesh ? "pointer" : "default";
		}
	});

	// pick
	scene.onPointerObservable.add((pi: any) => {
		const BABYLON = (window as any).BABYLON;
		if (pi.type !== BABYLON.PointerEventTypes.POINTERPICK) return;
		if (pi.event.button !== 0) return;
		if (lookState.active) return;

		const picked = pi.pickInfo?.pickedMesh;
		const nodeId = picked ? meshToNodeId.get(picked) : null;

		if (pi.event.ctrlKey || pi.event.metaKey || pi.event.shiftKey) {
			if (nodeId) {
				const current = new Set(selectedIds);
				if (current.has(nodeId)) current.delete(nodeId);
				else current.add(nodeId);
				postToExtension({ type: "select", ids: [...current] });
			}
		} else {
			postToExtension({ type: "select", ids: nodeId ? [nodeId] : [] });
		}
	});
}
