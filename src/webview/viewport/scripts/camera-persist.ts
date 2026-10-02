// src/webview/viewport/scripts/camera-persist.ts
// ✨ جدید — ذخیره و بازیابی state دوربین با vscode.setState
import { camera, camState } from "./state";
import { applyRotation } from "./camera";
import { vscode } from "./messaging";

interface PersistedCamera {
	position: { x: number; y: number; z: number };
	yaw: number;
	pitch: number;
	baseSpeed: number;
}

const SAVE_THROTTLE_MS = 300;

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function save(): void {
	if (!camera) return;
	const state: PersistedCamera = {
		position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
		yaw: camState.yaw,
		pitch: camState.pitch,
		baseSpeed: camState.baseSpeed,
	};
	try {
		const api = vscode();
		const prev = api.getState<Record<string, unknown>>() || {};
		api.setState({ ...prev, camera: state });
	} catch {
		/* ignore */
	}
}

export function scheduleSaveCamera(): void {
	if (saveTimer) return;
	saveTimer = setTimeout(() => {
		saveTimer = null;
		save();
	}, SAVE_THROTTLE_MS);
}

export function restoreCamera(): void {
	try {
		const api = vscode();
		const prev = api.getState<{ camera?: PersistedCamera }>();
		if (!prev?.camera || !camera) return;

		const { position, yaw, pitch, baseSpeed } = prev.camera;
		camera.position.set(position.x, position.y, position.z);
		camState.yaw = yaw;
		camState.pitch = pitch;
		camState.baseSpeed = baseSpeed;
		applyRotation();
	} catch {
		/* ignore */
	}
}

export function installCameraPersist(): void {
	// save دوره‌ای
	setInterval(save, 3000);
	// save قبل از بسته شدن
	window.addEventListener("beforeunload", save);
	// save روی blur
	window.addEventListener("blur", save);
}
