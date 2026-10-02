// src/webview/shader/scripts/state.ts
import type { ShaderDefinition, ShaderChannelKey, ChannelSource } from "../../../scene/shader/types";

export interface ShaderState {
	current: ShaderDefinition | null;
	focusedField: string | null;
}

export const state: ShaderState = {
	current: null,
	focusedField: null,
};

export function setCurrent(shader: ShaderDefinition | null): void {
	state.current = shader;
}
