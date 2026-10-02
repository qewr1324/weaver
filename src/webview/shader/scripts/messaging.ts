// src/webview/shader/scripts/messaging.ts
import { onExtensionMessage, postToExtension } from "../../shared/vscode-api";
import type { ShaderDefinition } from "../../../scene/shader/types";

export const Messaging = {
	pushShader(shader: ShaderDefinition): void {
		postToExtension({ type: "shader:update", payload: shader });
	},

	onShaderUpdate(handler: (shader: ShaderDefinition) => void): () => void {
		return onExtensionMessage((msg: any) => {
			if (msg.type === "shader:update") {
				handler(msg.payload);
			}
		});
	},

	ready(): void {
		postToExtension({ type: "ready" });
	},
};
