// src/scene/shader/serializer.ts
import { DEFAULT_SHADER } from "./defaults";
import { validateShader } from "./schema";
import type { ShaderDefinition } from "./types";

export const ShaderSerializer = {
	serialize(shader: ShaderDefinition): string {
		return JSON.stringify(shader, null, 2);
	},

	deserialize(text: string): ShaderDefinition {
		const raw = JSON.parse(text);
		const result = validateShader(raw);
		if (!result.success) {
			throw new Error(`Invalid shader: ${result.error.issues[0]?.message}`);
		}
		return result.data as ShaderDefinition;
	},

	tryDeserialize(text: string): { ok: true; shader: ShaderDefinition } | { ok: false; error: string } {
		try {
			return { ok: true, shader: ShaderSerializer.deserialize(text) };
		} catch (err) {
			return { ok: false, error: String(err) };
		}
	},
};

export function createDefaultShader(name = "Untitled Shader"): ShaderDefinition {
	return {
		...DEFAULT_SHADER,
		name,
		channels: JSON.parse(JSON.stringify(DEFAULT_SHADER.channels)),
		render: { ...DEFAULT_SHADER.render },
		output: { ...DEFAULT_SHADER.output, targets: [...DEFAULT_SHADER.output.targets] },
	};
}
