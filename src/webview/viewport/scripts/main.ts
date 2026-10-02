// src/webview/viewport/scripts/main.ts
import { dom, cacheDomRefs, editor, lookState, camState, setEngine, setScene, setCamera, setHighlightLayer, engine, scene, camera } from "./state";
import { applySceneConfig } from "./config";
import { onExtensionMessage, postToExtension } from "./messaging";
import { setupLookModeListeners, exitLookMode, setStatus } from "./look-mode";
import { applyRotation, updateCamera } from "./camera";
import { setupInput } from "./camera/input";
import { setupGizmo } from "./gizmo";
import { setupGizmoSync, applyTransformFromInspector } from "./gizmo/sync";
import { setupPicking, applySelection } from "./picking";
import { rebuildScene } from "./scene";
import { applySnap } from "./snap";

// ✨ فاز ۳ — ماژول‌های جدید
import { installCameraPersist, restoreCamera } from "./camera-persist";
import { installAxesIndicator, drawAxesIndicator } from "./axes-indicator";
import { installViewportContextMenu } from "./context-menu";
import { installPerformanceHud, updatePerformanceHud } from "./performance-hud";
import { setupFocusHotkey } from "./focus";
import { drawSelectionBox } from "./selection-box";

function boot(): void {
	cacheDomRefs();

	if (typeof (window as any).BABYLON === "undefined") {
		dom.loading.textContent = "Failed to load Babylon";
		return;
	}
	dom.loading.remove();
	console.log("[Weaver] init");

	const BABYLON = (window as any).BABYLON;

	const eng = new BABYLON.Engine(dom.canvas, true, {
		preserveDrawingBuffer: true,
		stencil: true,
	});
	const sc = new BABYLON.Scene(eng);
	sc.clearColor = new BABYLON.Color4(0.15, 0.18, 0.24, 1);

	const cam = new BABYLON.FreeCamera("__editor_camera", new BABYLON.Vector3(8, 6, -10), sc);
	cam.minZ = 0.05;
	cam.maxZ = 5000;
	cam.fov = 0.9;

	setEngine(eng);
	setScene(sc);
	setCamera(cam);
	(window as any).__weaver_scene = sc;

	applyRotation();
	restoreCamera(); // ✨ جدید — بازیابی موقعیت دوربین

	// lights
	const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.5, -1, -0.3), sc);
	sun.intensity = 1.2;
	const amb = new BABYLON.HemisphericLight("amb", new BABYLON.Vector3(0, 1, 0), sc);
	amb.intensity = 0.8;

	// grid
	const grid = BABYLON.MeshBuilder.CreateGround("__grid", { width: 100, height: 100 }, sc);
	try {
		const gm = new BABYLON.GridMaterial("__gm", sc);
		gm.majorUnitFrequency = 10;
		gm.minorUnitVisibility = 0.35;
		gm.mainColor = new BABYLON.Color3(0.3, 0.33, 0.4);
		gm.lineColor = new BABYLON.Color3(0.5, 0.52, 0.6);
		grid.material = gm;
	} catch {
		const sm = new BABYLON.StandardMaterial("__sm", sc);
		sm.diffuseColor = new BABYLON.Color3(0.2, 0.22, 0.28);
		grid.material = sm;
	}
	grid.isPickable = false;

	// highlight
	const hl = new BABYLON.HighlightLayer("__hl", sc);
	hl.innerGlow = false;
	hl.outerGlow = true;
	setHighlightLayer(hl);

	// setup
	setupGizmo();
	setupGizmoSync();
	setupInput();
	setupPicking();
	setupLookModeListeners();

	// ✨ فاز ۳ — نصب ماژول‌های جدید
	installCameraPersist();
	installAxesIndicator();
	installViewportContextMenu();
	installPerformanceHud();
	setupFocusHotkey();

	eng.runRenderLoop(() => {
		updateCamera(eng.getDeltaTime() / 1000);
		applySnap();
		sc.render();
		dom.fps.textContent = eng.getFps().toFixed(0) + " FPS";

		// ✨ فاز ۳ — آپدیت‌های هر فریم
		drawAxesIndicator();
		updatePerformanceHud();
		drawSelectionBox();
	});

	window.addEventListener("resize", () => eng.resize());
	setTimeout(() => eng.resize(), 100);

	dom.canvas.focus();
	postToExtension({ type: "ready" });
}

function setupMessageRouter(): void {
	onExtensionMessage((msg: any) => {
		if (msg.type === "scene:update") {
			if (scene) {
				if (msg.payload.config) applySceneConfig(msg.payload.config);
				rebuildScene(msg.payload);
			}
		} else if (msg.type === "selection:update") {
			applySelection(msg.ids || []);
		} else if (msg.type === "transform:apply") {
			applyTransformFromInspector(msg.payload);
		} else if (msg.type === "config:resolved") {
			applySceneConfig(msg.payload);
		} else if (msg.type === "error") {
			dom.loading.textContent = "Error: " + msg.message;
		}
	});
}

window.addEventListener("load", () => {
	boot();
	setupMessageRouter();
});

// re-export برای دسترسی آسان از کنسول (اختیاری)
export { editor, camState, lookState };
