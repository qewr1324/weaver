// src/webview/shader/scripts/codegen/common.ts
import { CHANNEL_ORDER } from "../../../../scene/shader/defaults";
import type { ShaderDefinition, ShaderChannel, ShaderChannelKey } from "../../../../scene/shader/types";

export interface ChannelUsage {
	usesColor: boolean;
	usesNumber: boolean;
	usesTexture: boolean;
	usesIntensity: boolean;
}

export function getChannelUsage(ch: ShaderChannel): ChannelUsage {
	return {
		usesColor: ch.source === "color" || ch.source === "color-texture",
		usesNumber: ch.source === "number" || ch.source === "number-texture",
		usesTexture: ch.source === "texture" || ch.source === "color-texture" || ch.source === "number-texture",
		usesIntensity: ch.source === "color-texture" || ch.source === "number-texture",
	};
}

export function getActiveChannels(shader: ShaderDefinition): ShaderChannelKey[] {
	const out: ShaderChannelKey[] = [];
	for (const key of CHANNEL_ORDER) {
		if (shader.channels[key].enabled) out.push(key);
	}
	return out;
}

export function channelName(key: ShaderChannelKey): string {
	return key.charAt(0).toUpperCase() + key.slice(1);
}

export function toSnake(s: string): string {
	return s.replace(/([A-Z])/g, "_$1").toLowerCase();
}

export function toConstName(key: string): string {
	return key.replace(/([A-Z])/g, "_$1").toUpperCase();
}

export function colorToHex(c: [number, number, number, number]): string {
	const b = (v: number) =>
		Math.max(0, Math.min(255, Math.round(v * 255)))
			.toString(16)
			.padStart(2, "0");
	return `#${b(c[0])}${b(c[1])}${b(c[2])}${b(c[3])}`;
}

export function colorToVec4Literal(c: [number, number, number, number], lang: "glsl" | "hlsl" | "csharp" | "typescript" = "glsl"): string {
	const f = (v: number) => v.toFixed(4);
	if (lang === "glsl") return `vec4(${f(c[0])}, ${f(c[1])}, ${f(c[2])}, ${f(c[3])})`;
	if (lang === "hlsl") return `float4(${f(c[0])}, ${f(c[1])}, ${f(c[2])}, ${f(c[3])})`;
	if (lang === "csharp") return `new Vector4(${f(c[0])}f, ${f(c[1])}f, ${f(c[2])}f, ${f(c[3])}f)`;
	return `[${f(c[0])}, ${f(c[1])}, ${f(c[2])}, ${f(c[3])}]`;
}
