// src/webview/shader/scripts/main.ts
import { mustById } from "../../shared/dom";
import { bindInputs } from "./bindings";
import { Messaging } from "./messaging";
import { renderFull, updatePreviewOnly } from "./render";
import { setCurrent, state } from "./state";

const root = mustById("root");

renderFull(root, null, { onBind: () => bindInputs({ root }) });

Messaging.onShaderUpdate((shader) => {
	const isSameShader = state.current?.name === shader.name;

	setCurrent(shader);

	if (isSameShader) {
		updatePreviewOnly(shader);
		return;
	}

	renderFull(root, shader, {
		onBind: () => bindInputs({ root }),
	});
});

Messaging.ready();
