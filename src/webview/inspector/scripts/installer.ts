// src/webview/inspector/scripts/installer.ts
// ✨ جدید — نصب یکجای همه‌ی ماژول‌های ایزوله
import { installCollapse } from "./collapse";
import { installContextMenu } from "./context-menu";
import { installEnabledToggle } from "./enabled-toggle";
import { installKeyboardNav } from "./keyboard-nav";

let installed = false;

/**
 * یک بار برای همیشه (روی root) نصب می‌کنه.
 * بعد از هر render، لازم نیست دوباره صدا بزنی —
 * چون همه listener ها delegated هستن.
 */
export function installInspectorEnhancements(root: HTMLElement): void {
	if (installed) return;
	installed = true;

	installContextMenu(root);
	installCollapse(root);
	installEnabledToggle(root);
	installKeyboardNav(root);
}
