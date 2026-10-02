// src/webview/viewport/scripts/camera/input/index.ts
import { dom, keys, selectedIds, lookState, camState, setShiftHeld, setSpaceHeld } from "../../state";
import { rotate } from "../index";
import { exitLookMode, toggleLookMode, setStatus } from "../../look-mode";
import { setTransformMode } from "../../gizmo";
import { postToExtension } from "../../messaging";
import { scheduleSaveCamera } from "../../camera-persist";

let fallbackX = 0;
let fallbackY = 0;

function handleGlobalKey(code: string, e: KeyboardEvent): boolean {
	// F → toggle look mode
	if (code === "KeyF" && !e.shiftKey) {
		e.preventDefault();
		e.stopPropagation();
		toggleLookMode();
		return true;
	}

	// Delete / Backspace → remove selected
	if (code === "Delete" || code === "Backspace") {
		if (selectedIds.length > 0) {
			e.preventDefault();
			e.stopPropagation();
			for (const id of selectedIds) {
				postToExtension({ type: "remove:node", nodeId: id });
			}
		}
		return true;
	}

	// Escape → exit look / deselect
	if (code === "Escape") {
		if (lookState.active) exitLookMode();
		else postToExtension({ type: "select", ids: [] });
		return true;
	}

	// Ctrl/Cmd + D → duplicate
	if ((e.ctrlKey || e.metaKey) && code === "KeyD") {
		if (selectedIds.length > 0) {
			e.preventDefault();
			e.stopPropagation();
			for (const id of selectedIds) {
				postToExtension({ type: "duplicate:node", nodeId: id });
			}
		}
		return true;
	}

	// Ctrl/Cmd + Shift + A → deselect all
	if ((e.ctrlKey || e.metaKey) && e.shiftKey && code === "KeyA") {
		e.preventDefault();
		e.stopPropagation();
		postToExtension({ type: "select", ids: [] });
		return true;
	}

	// Ctrl/Cmd + Shift + G → toggle grid visibility
	if ((e.ctrlKey || e.metaKey) && e.shiftKey && code === "KeyG") {
		e.preventDefault();
		e.stopPropagation();
		const sc = (window as any).__weaver_scene;
		if (sc) {
			const grid = sc.getMeshByName("__grid");
			if (grid) grid.isVisible = !grid.isVisible;
			const axX = sc.getMeshByName("__axis_x");
			if (axX) axX.isVisible = grid?.isVisible ?? true;
			const axZ = sc.getMeshByName("__axis_z");
			if (axZ) axZ.isVisible = grid?.isVisible ?? true;
		}
		return true;
	}

	// Home → focus
	if (code === "Home") {
		e.preventDefault();
		e.stopPropagation();
		return true;
	}

	// ✅ W / E / R → transform mode (فقط وقتی در look mode نیستیم و modifier نداریم)
	if (!lookState.active && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
		if (code === "KeyW") {
			e.preventDefault();
			e.stopPropagation();
			setTransformMode("move");
			return true;
		}
		if (code === "KeyE") {
			e.preventDefault();
			e.stopPropagation();
			setTransformMode("rotate");
			return true;
		}
		if (code === "KeyR") {
			e.preventDefault();
			e.stopPropagation();
			setTransformMode("scale");
			return true;
		}
	}

	return false;
}

const LOOK_HANDLED_CODES = new Set<string>(["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "KeyI", "KeyJ", "KeyK", "KeyL", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "ShiftLeft", "ShiftRight"]);

export function setupInput(): void {
	document.addEventListener(
		"contextmenu",
		(e) => {
			if ((e.target as HTMLElement)?.id === "renderCanvas") {
				e.preventDefault();
			}
		},
		{ capture: true },
	);

	// wheel → speed
	dom.canvas.addEventListener(
		"wheel",
		(e: WheelEvent) => {
			e.preventDefault();
			camState.baseSpeed *= e.deltaY > 0 ? 0.9 : 1.1;
			camState.baseSpeed = Math.max(0.05, Math.min(20, camState.baseSpeed));
			setStatus("● Speed: " + camState.baseSpeed.toFixed(2), true);
			scheduleSaveCamera();
		},
		{ passive: false },
	);

	// focus canvas on LMB
	dom.canvas.addEventListener("mousedown", (e: MouseEvent) => {
		if (e.button === 0 && !lookState.active) dom.canvas.focus();
	});

	// pointer lock mousemove
	document.addEventListener("mousemove", (e: MouseEvent) => {
		if (!lookState.active) return;
		if (!lookState.pointerLocked) return;
		rotate(e.movementX, e.movementY);
	});

	// fallback mousemove
	window.addEventListener("mousemove", (e: MouseEvent) => {
		if (!lookState.active) return;
		if (lookState.pointerLocked) return;
		const dx = e.clientX - fallbackX;
		const dy = e.clientY - fallbackY;
		fallbackX = e.clientX;
		fallbackY = e.clientY;
		rotate(dx, dy);
	});

	// prevent default mousedown in look mode
	dom.canvas.addEventListener(
		"mousedown",
		(e: MouseEvent) => {
			if (lookState.active) e.preventDefault();
		},
		{ capture: true },
	);

	// keyboard down
	window.addEventListener(
		"keydown",
		(e: KeyboardEvent) => {
			if (e.target && (e.target as HTMLElement).tagName === "INPUT") return;

			const code = e.code;

			if (handleGlobalKey(code, e)) return;
			if (!lookState.active) return;

			if (LOOK_HANDLED_CODES.has(code)) {
				e.preventDefault();
				e.stopPropagation();
			}

			keys.add(code);
			if (code === "ShiftLeft" || code === "ShiftRight") setShiftHeld(true);
			if (code === "Space") setSpaceHeld(true);
		},
		{ capture: true },
	);

	// keyboard up
	window.addEventListener(
		"keyup",
		(e: KeyboardEvent) => {
			const code = e.code;

			keys.delete(code);
			if (code === "ShiftLeft" || code === "ShiftRight") setShiftHeld(false);
			if (code === "Space") setSpaceHeld(false);

			if (!lookState.active) return;

			if (LOOK_HANDLED_CODES.has(code) && code !== "ShiftLeft" && code !== "ShiftRight") {
				e.preventDefault();
				e.stopPropagation();
			}
		},
		{ capture: true },
	);

	// blur → release keys
	window.addEventListener("blur", () => {
		keys.clear();
		setShiftHeld(false);
		setSpaceHeld(false);
	});
}
