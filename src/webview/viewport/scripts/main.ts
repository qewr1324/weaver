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

// ✨ Grid جدید
import { buildGrid, DEFAULT_GRID, getGridOptions } from "./grid";
import { installGridControls } from "./grid-controls";

// ⚠️ موقت — برای debug
import { installLeakDetector } from "./debug-leak";

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
	restoreCamera();

	// lights
	const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.5, -1, -0.3), sc);
	sun.intensity = 1.2;
	const amb = new BABYLON.HemisphericLight("amb", new BABYLON.Vector3(0, 1, 0), sc);
	amb.intensity = 0.8;

	// ✅ grid — حالا با ماژول grid.ts ساخته میشه
	// (buildGrid در installGridControls صدا زده میشه)

	// ✅ HighlightLayer حذف شد — از outline استفاده می‌کنیم

	// setup
	setupGizmo();
	setupGizmoSync();
	setupInput();
	setupPicking();
	setupLookModeListeners();

	// ✨ فاز ۳
	installCameraPersist();
	installAxesIndicator();
	installViewportContextMenu();
	installPerformanceHud();
	setupFocusHotkey();

	// ✨ grid
	installGridControls(); // این buildGrid رو هم صدا می‌زنه

	// ⚠️ debug
	installLeakDetector();

	eng.runRenderLoop(() => {
		updateCamera(eng.getDeltaTime() / 1000);
		applySnap();
		sc.render();
		dom.fps.textContent = eng.getFps().toFixed(0) + " FPS";

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

export { editor, camState, lookState };
