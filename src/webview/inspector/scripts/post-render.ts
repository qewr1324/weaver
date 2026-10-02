// src/webview/inspector/scripts/post-render.ts
// ✨ جدید — بعد از هر render صدا بزن
import { applyCollapseState } from "./collapse";
import { injectEnabledToggle } from "./enabled-toggle";

export function afterRender(root: HTMLElement): void {
	injectEnabledToggle(root);
	applyCollapseState(root);
}
