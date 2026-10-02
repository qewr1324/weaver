// src/webview/viewport/scripts/camera/index.ts
import { camera, camState, keys, lookState, shiftHeld, spaceHeld } from "../state";

export function applyRotation(): void {
	if (!camera) return;
	const cp = Math.cos(camState.pitch);
	const BABYLON = (window as any).BABYLON;
	const dir = new BABYLON.Vector3(cp * Math.sin(camState.yaw), Math.sin(camState.pitch), cp * Math.cos(camState.yaw));
	camera.setTarget(camera.position.add(dir));
}

export function rotate(dx: number, dy: number): void {
	camState.yaw += dx * lookState.mouseSens;
	camState.pitch -= dy * lookState.mouseSens;
	camState.pitch = Math.max(-1.55, Math.min(1.55, camState.pitch));
	applyRotation();
}

export function updateCamera(dt: number): void {
	if (!lookState.active) return;
	if (!camera) return;

	const lookMult = shiftHeld ? camState.sprintMult : spaceHeld ? camState.slowMult : 1;
	const lookStep = camState.baseLookSpeed * lookMult * dt;

	let rotated = false;
	if (keys.has("KeyJ") || keys.has("ArrowLeft")) {
		camState.yaw -= lookStep;
		rotated = true;
	}
	if (keys.has("KeyL") || keys.has("ArrowRight")) {
		camState.yaw += lookStep;
		rotated = true;
	}
	if (keys.has("KeyI") || keys.has("ArrowUp")) {
		camState.pitch += lookStep;
		rotated = true;
	}
	if (keys.has("KeyK") || keys.has("ArrowDown")) {
		camState.pitch -= lookStep;
		rotated = true;
	}

	if (rotated) {
		camState.pitch = Math.max(-1.55, Math.min(1.55, camState.pitch));
		applyRotation();
	}

	if (keys.size === 0) return;

	const moveMult = shiftHeld ? camState.sprintMult : spaceHeld ? camState.slowMult : 1;
	const speed = camState.baseSpeed * moveMult * dt * 60;

	const BABYLON = (window as any).BABYLON;
	const fwd = camera.getDirection(BABYLON.Axis.Z);
	const right = camera.getDirection(BABYLON.Axis.X);

	const move = BABYLON.Vector3.Zero();
	if (keys.has("KeyW")) move.addInPlace(fwd);
	if (keys.has("KeyS")) move.subtractInPlace(fwd);
	if (keys.has("KeyD")) move.addInPlace(right);
	if (keys.has("KeyA")) move.subtractInPlace(right);
	if (keys.has("KeyE")) move.y += 1;
	if (keys.has("KeyQ")) move.y -= 1;

	if (move.lengthSquared() > 0) {
		move.normalize().scaleInPlace(speed);
		camera.position.addInPlace(move);
	}
}
