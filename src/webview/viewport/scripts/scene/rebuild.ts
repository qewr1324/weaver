// src/webview/viewport/scripts/scene/rebuild.ts
import { nodeIdToMesh, nodeIdToRoot, rootToNodeId, selectedIds } from "../state";
import { detachGizmo } from "../gizmo";
import { applySelection } from "../picking";
import { buildNode } from "./build-node";

export function rebuildScene(data: any): void {
	detachGizmo();

	for (const [id, obj] of nodeIdToMesh) {
		try {
			obj.dispose();
		} catch (e) {
			console.warn("[Weaver] dispose mesh failed", id, e);
		}
	}
	for (const [id, obj] of nodeIdToRoot) {
		try {
			obj.dispose();
		} catch (e) {
			console.warn("[Weaver] dispose root failed", id, e);
		}
	}
	nodeIdToMesh.clear();
	nodeIdToRoot.clear();
	rootToNodeId.clear();

	for (const child of data.root.children ?? []) buildNode(child, null);

	applySelection(selectedIds);
}
