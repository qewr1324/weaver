// src/webview/shader/scripts/io.ts
import type { ShaderDefinition } from "../../../scene/shader/types";
import { validateShader } from "../../../scene/shader/schema";
import { postToExtension } from "../../shared/vscode-api";
import { state } from "./state";

/**
 * Export shader به JSON string.
 */
export function exportShaderToJSON(shader: ShaderDefinition): string {
	return JSON.stringify(shader, null, 2);
}

/**
 * Import shader از JSON string.
 */
export function importShaderFromJSON(text: string): { ok: true; shader: ShaderDefinition } | { ok: false; error: string } {
	try {
		const raw = JSON.parse(text);
		const result = validateShader(raw);
		if (!result.success) {
			return { ok: false, error: result.error.issues[0]?.message ?? "Invalid shader" };
		}
		return { ok: true, shader: result.data as ShaderDefinition };
	} catch (err) {
		return { ok: false, error: String(err) };
	}
}

/**
 * کپی به کلیپ‌بورد.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

/**
 * خواندن از کلیپ‌بورد.
 */
export async function readFromClipboard(): Promise<string | null> {
	try {
		return await navigator.clipboard.readText();
	} catch {
		return null;
	}
}

/**
 * اعمال shader جدید به state + ذخیره.
 */
export function applyShader(shader: ShaderDefinition): void {
	state.current = shader;
	postToExtension({ type: "shader:update", payload: shader });
}

/**
 * Duplicate shader با اسم جدید.
 */
export function duplicateShader(shader: ShaderDefinition): ShaderDefinition {
	const copy: ShaderDefinition = {
		...shader,
		name: `${shader.name} (Copy)`,
		render: { ...shader.render },
		channels: JSON.parse(JSON.stringify(shader.channels)),
		output: { ...shader.output, targets: [...shader.output.targets] },
	};
	return copy;
}

/**
 * Reset shader به default (با نگه‌داشتن اسم و output).
 */
export function resetShader(shader: ShaderDefinition): ShaderDefinition {
	// این کار رو می‌کنیم که از circular import جلوگیری کنیم
	const { applyPreset } = require("../../../scene/shader/presets") as typeof import("../../../scene/shader/presets");
	return applyPreset(shader, "standard-pbr");
}
