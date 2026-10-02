// src/webview/viewport/scripts/toolbar/index.ts
import { editor, dom, scene } from "../state";
import { setActiveInGroup } from "./buttons";
import { applyGizmoMode } from "../gizmo";
import { setStatus } from "../look-mode";

export function setReferenceMode(mode: "world" | "object"): void {
	editor.referenceMode = mode;
	applyGizmoMode();
	setActiveInGroup(dom.refGroup, mode);
	setStatus("● Space: " + mode, true);
}

export function setShaderMode(mode: "solid" | "wireframe" | "both"): void {
	editor.shaderMode = mode;
	if (scene) {
		scene.meshes.forEach((m: any) => {
			if (!m.material || m.name === "__grid") return;
			if (m.name.endsWith("_g")) return;
			if (m.material.wireframe !== undefined) {
				m.material.wireframe = mode === "wireframe" || mode === "both";
			}
			m.material.alpha = mode === "both" ? 0.85 : 1;
		});
	}
	setActiveInGroup(dom.shaderGroup, mode);
	setStatus("● View: " + mode, true);
}
