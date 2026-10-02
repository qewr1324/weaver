// src/webview/viewport/scripts/config.ts
import { editor, dom, setHoverColor, setSelectColor, camState, gizmoManager } from "./state";
import { addObject } from "./scene";
import { setTransformMode } from "./gizmo";
import { setReferenceMode } from "./toolbar";
import { setShaderMode } from "./toolbar";
import { toggleSnapGrid, toggleSnapObject } from "./snap";
import { makeButton, clearGroup } from "./toolbar/buttons";

export interface ViewportConfig {
	toolbar: {
		enabled: {
			addObjects: boolean;
			transformModes: boolean;
			referenceModes: boolean;
			shaderModes: boolean;
			snap: boolean;
		};
		transformMode: "move" | "rotate" | "scale";
		referenceMode: "world" | "object";
		shaderMode: "solid" | "wireframe" | "both";
		snapGrid: boolean;
		snapGridSize: number;
		snapObject: boolean;
		addObjects: Array<{ id: string; label: string; icon: string; geometry: string }>;
		transformModes: Array<{ id: string; label: string; icon: string }>;
		referenceModes: Array<{ id: string; label: string; icon: string }>;
		shaderModes: Array<{ id: string; label: string; icon: string }>;
	};
	camera: {
		baseSpeed: number;
		baseLookSpeed: number;
		sprintMult: number;
		slowMult: number;
	};
	highlights: {
		hover: { r: number; g: number; b: number };
		selected: { r: number; g: number; b: number };
	};
	gizmo: { scaleRatio: number };
}

let config: ViewportConfig | null = null;

export function getConfig(): ViewportConfig | null {
	return config;
}

export const DEFAULT_CONFIG: ViewportConfig = {
	toolbar: {
		enabled: {
			addObjects: true,
			transformModes: true,
			referenceModes: true,
			shaderModes: true,
			snap: true,
		},
		transformMode: "move",
		referenceMode: "world",
		shaderMode: "solid",
		snapGrid: false,
		snapGridSize: 0.5,
		snapObject: false,
		addObjects: [],
		transformModes: [],
		referenceModes: [],
		shaderModes: [],
	},
	camera: { baseSpeed: 0.35, baseLookSpeed: 1.8, sprintMult: 4, slowMult: 0.25 },
	highlights: {
		hover: { r: 0.4, g: 0.75, b: 1.0 },
		selected: { r: 1.0, g: 0.6, b: 0.15 },
	},
	gizmo: { scaleRatio: 1.0 },
};

export function applySceneConfig(raw: any): void {
	if (!raw) return;

	config = {
		toolbar: { ...DEFAULT_CONFIG.toolbar, ...(raw.toolbar || {}) },
		camera: { ...DEFAULT_CONFIG.camera, ...(raw.camera || {}) },
		highlights: {
			hover: { ...DEFAULT_CONFIG.highlights.hover, ...(raw.highlights?.hover || {}) },
			selected: { ...DEFAULT_CONFIG.highlights.selected, ...(raw.highlights?.selected || {}) },
		},
		gizmo: { ...DEFAULT_CONFIG.gizmo, ...(raw.gizmo || {}) },
	};
	config.toolbar.enabled = {
		...DEFAULT_CONFIG.toolbar.enabled,
		...(raw.toolbar?.enabled || {}),
	};

	const BABYLON = (window as any).BABYLON;
	setHoverColor(new BABYLON.Color3(config.highlights.hover.r, config.highlights.hover.g, config.highlights.hover.b));
	setSelectColor(new BABYLON.Color3(config.highlights.selected.r, config.highlights.selected.g, config.highlights.selected.b));

	camState.baseSpeed = config.camera.baseSpeed;
	camState.baseLookSpeed = config.camera.baseLookSpeed;
	camState.sprintMult = config.camera.sprintMult;
	camState.slowMult = config.camera.slowMult;

	editor.transformMode = config.toolbar.transformMode || "move";
	editor.referenceMode = config.toolbar.referenceMode || "world";
	editor.shaderMode = config.toolbar.shaderMode || "solid";
	editor.snapGrid = config.toolbar.snapGrid ?? false;
	editor.snapGridSize = config.toolbar.snapGridSize ?? 0.5;
	editor.snapObject = config.toolbar.snapObject ?? false;

	if (gizmoManager) {
		const ratio = config.gizmo.scaleRatio;
		if (gizmoManager.gizmos.positionGizmo) gizmoManager.gizmos.positionGizmo.scaleRatio = ratio;
		if (gizmoManager.gizmos.rotationGizmo) gizmoManager.gizmos.rotationGizmo.scaleRatio = ratio;
		if (gizmoManager.gizmos.scaleGizmo) gizmoManager.gizmos.scaleGizmo.scaleRatio = ratio;
	}

	buildToolbar();
}

export function buildToolbar(): void {
	if (!config) return;

	clearGroup(dom.addObjWrap, false);
	clearGroup(dom.transformGroup, true);
	clearGroup(dom.refGroup, true);
	clearGroup(dom.shaderGroup, true);
	clearGroup(dom.snapGroup, true);

	const en = config.toolbar.enabled;

	if (en.addObjects) {
		dom.addObjWrap.style.display = "";
		dom.addObjMenu.innerHTML = "";
		for (const item of config.toolbar.addObjects || []) {
			const el = document.createElement("div");
			el.className = "tb-dd-item";
			el.innerHTML = '<span class="icon">' + item.icon + "</span>" + item.label;
			el.addEventListener("click", () => {
				addObject(item.geometry);
				dom.addObjWrap.classList.remove("open");
			});
			dom.addObjMenu.appendChild(el);
		}
		dom.addObjBtn.onclick = (e) => {
			e.stopPropagation();
			dom.addObjWrap.classList.toggle("open");
		};
	} else {
		dom.addObjWrap.style.display = "none";
	}

	if (en.transformModes) {
		dom.transformGroup.style.display = "";
		for (const m of config.toolbar.transformModes || []) {
			const btn = makeButton(m.icon, m.label, () => setTransformMode(m.id as any), m.id === editor.transformMode);
			btn.dataset.mode = m.id;
			dom.transformGroup.appendChild(btn);
		}
	} else {
		dom.transformGroup.style.display = "none";
	}

	if (en.referenceModes) {
		dom.refGroup.style.display = "";
		for (const m of config.toolbar.referenceModes || []) {
			const btn = makeButton(m.icon, m.label, () => setReferenceMode(m.id as any), m.id === editor.referenceMode);
			btn.dataset.mode = m.id;
			dom.refGroup.appendChild(btn);
		}
	} else {
		dom.refGroup.style.display = "none";
	}

	if (en.shaderModes) {
		dom.shaderGroup.style.display = "";
		for (const m of config.toolbar.shaderModes || []) {
			const btn = makeButton(m.icon, m.label, () => setShaderMode(m.id as any), m.id === editor.shaderMode);
			btn.dataset.mode = m.id;
			dom.shaderGroup.appendChild(btn);
		}
	} else {
		dom.shaderGroup.style.display = "none";
	}

	if (en.snap) {
		dom.snapGroup.style.display = "";
		const snapGridBtn = makeButton("▦", "Grid", () => toggleSnapGrid(), editor.snapGrid);
		snapGridBtn.title = "Snap to Grid (" + editor.snapGridSize + ")";
		snapGridBtn.dataset.snap = "grid";
		dom.snapGroup.appendChild(snapGridBtn);

		const snapObjBtn = makeButton("⬡", "Object", () => toggleSnapObject(), editor.snapObject);
		snapObjBtn.dataset.snap = "object";
		dom.snapGroup.appendChild(snapObjBtn);
	} else {
		dom.snapGroup.style.display = "none";
	}
}
