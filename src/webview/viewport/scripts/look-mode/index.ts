// src/webview/viewport/scripts/look-mode/index.ts
import { dom, keys, lookState, setShiftHeld, setSpaceHeld } from "../state";

export function setStatus(text: string, active: boolean, isLook?: boolean): void {
	dom.status.textContent = text;
	dom.status.classList.toggle("off", !active);
	dom.status.classList.toggle("look", !!isLook);
}

export function enterLookMode(): void {
	if (lookState.active) return;
	lookState.active = true;
	dom.canvas.classList.add("look-mode");
	dom.lookOverlay.classList.add("active");
	dom.crosshair.classList.add("active");
	dom.lookModeBtn.classList.add("active");
	dom.hudLookKey.classList.add("on");
	setStatus("● LOOK MODE — press F to exit", true, true);

	const canvas: any = dom.canvas;
	const p = canvas.requestPointerLock?.({ unadjustedMovement: true });
	if (p && p.catch) {
		p.catch(() => canvas.requestPointerLock());
	}
	dom.canvas.focus();
	console.log("[Weaver] look mode ON");
}

export function exitLookMode(): void {
	if (!lookState.active) return;
	lookState.active = false;
	dom.canvas.classList.remove("look-mode");
	dom.lookOverlay.classList.remove("active");
	dom.crosshair.classList.remove("active");
	dom.lookModeBtn.classList.remove("active");
	dom.hudLookKey.classList.remove("on");
	setStatus("● F to look · WASD to move", false, false);

	keys.clear();
	setShiftHeld(false);
	setSpaceHeld(false);

	if (lookState.pointerLocked) {
		document.exitPointerLock?.();
	}
	console.log("[Weaver] look mode OFF");
}

export function toggleLookMode(): void {
	if (lookState.active) exitLookMode();
	else enterLookMode();
}

export function setupLookModeListeners(): void {
	document.addEventListener("pointerlockchange", () => {
		lookState.pointerLocked = document.pointerLockElement === dom.canvas;
		if (lookState.active && !lookState.pointerLocked) {
			exitLookMode();
		}
	});

	document.addEventListener("pointerlockerror", () => {
		console.log("[Weaver] pointerlock error");
	});

	dom.lookModeBtn.addEventListener("click", () => {
		toggleLookMode();
	});
}
