// src/webview/inspector/scripts/bindings/index.ts
import { renderFull } from "../render";
import { state } from "../state";
import { bindComponentInputs } from "./component-binding";
import { bindFilterInput } from "./filter-binding";
import { bindNameInput } from "./name-binding";
import { bindResetAll } from "./reset-all-binding";
import { bindTransformInputs } from "./transform-binding";

export interface BindContext {
	root: HTMLElement;
}

export function bindInputs(ctx: BindContext): void {
	bindTransformInputs(ctx.root);
	bindResetAll(ctx.root); // ✨ جدید
	bindComponentInputs(ctx.root);
	bindNameInput();
	bindFilterInput({
		onRerender: () => {
			const scroll = ctx.root.scrollTop;
			renderFull(ctx.root, state, { onBind: () => bindInputs(ctx) });
			ctx.root.scrollTop = scroll;
		},
	});
}
