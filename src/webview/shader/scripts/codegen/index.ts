// src/webview/shader/scripts/codegen/index.ts
import type { ShaderDefinition } from "../../../../scene/shader/types";
import { generateBabylon } from "./babylon";
import { generateGLSL } from "./glsl";
import { generateLibGDX } from "./libgdx";
import { generateMonoGame } from "./monogame";

export type TargetLanguage = "glsl" | "babylon" | "libgdx" | "monogame";

export interface GeneratedFiles {
	[filename: string]: string;
}

export function generateCode(shader: ShaderDefinition, target: TargetLanguage): GeneratedFiles {
	switch (target) {
		case "glsl": {
			const { vertex, fragment } = generateGLSL(shader);
			return {
				[`${slug(shader.name)}.vert`]: vertex,
				[`${slug(shader.name)}.frag`]: fragment,
			};
		}
		case "babylon":
			return {
				[`${slug(shader.name)}.material.ts`]: generateBabylon(shader),
			};
		case "libgdx": {
			const { vertex, fragment, java } = generateLibGDX(shader);
			return {
				[`${slug(shader.name)}.vert`]: vertex,
				[`${slug(shader.name)}.frag`]: fragment,
				[`${toPascalCase(shader.name)}Shader.java`]: java,
			};
		}
		case "monogame":
			return {
				[`${toPascalCase(shader.name)}.fx`]: generateMonoGame(shader),
			};
	}
}

export function generateAll(shader: ShaderDefinition): GeneratedFiles {
	const all: GeneratedFiles = {};
	for (const target of shader.output.targets) {
		Object.assign(all, generateCode(shader, target));
	}
	return all;
}

function slug(s: string): string {
	return s
		.toLowerCase()
		.replace(/\s+/g, "_")
		.replace(/[^a-z0-9_]/g, "");
}

function toPascalCase(s: string): string {
	return s.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/^(.)/, (c) => c.toUpperCase());
}
