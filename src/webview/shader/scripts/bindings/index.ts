// src/webview/shader/scripts/bindings/index.ts
import { bindChannelInputs } from "./channel-binding";
import { bindCodeOutput } from "./code-binding";
import { bindHeaderInputs } from "./header-binding";
import { bindSettingsInputs } from "./settings-binding";
import { renderFull } from "../render";
import { state } from "../state";

export interface BindContext {
	root: HTMLElement;
}

export function bindInputs(ctx: BindContext): void {
	const rerender = () => {
		const body = ctx.root.querySelector(".shader-body");
		const scroll = body?.scrollTop ?? 0;
		renderFull(ctx.root, state.current, { onBind: () => bindInputs(ctx) });
		const newBody = ctx.root.querySelector(".shader-body");
		if (newBody) newBody.scrollTop = scroll;
	};

	bindHeaderInputs(ctx.root, { onRerender: rerender });
	bindSettingsInputs(ctx.root);
	bindChannelInputs(ctx.root, { onRerender: rerender });
	bindCodeOutput(ctx.root);
}
