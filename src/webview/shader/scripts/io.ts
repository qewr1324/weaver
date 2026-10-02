// src/webview/shader/scripts/io.ts
import type { ShaderDefinition } from "../../../scene/shader/types";
import { validateShader } from "../../../scene/shader/schema";
import { applyPreset } from "../../../scene/shader/presets";
import { postToExtension } from "../../shared/vscode-api";
import { state } from "./state";

export function exportShaderToJSON(shader: ShaderDefinition): string {
	return JSON.stringify(shader, null, 2);
}

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

export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

export async function readFromClipboard(): Promise<string | null> {
	try {
		return await navigator.clipboard.readText();
	} catch {
		return null;
	}
}

export function applyShader(shader: ShaderDefinition): void {
	state.current = shader;
	postToExtension({ type: "shader:update", payload: shader });
}

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

export function resetShader(shader: ShaderDefinition): ShaderDefinition {
	return applyPreset(shader, "standard-pbr");
}
