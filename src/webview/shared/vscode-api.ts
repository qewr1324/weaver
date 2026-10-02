// src/webview/shared/vscode-api.ts
/**
 * Wrapper نازک روی acquireVsCodeApi.
 * در هر webview فقط یک بار قابل صدا زدن است.
 */

interface VsCodeApi {
	postMessage(msg: unknown): void;
	getState<T = unknown>(): T | undefined;
	setState<T>(state: T): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let _api: VsCodeApi | null = null;

export function getVsCodeApi(): VsCodeApi {
	if (_api) return _api;
	if (typeof acquireVsCodeApi !== "function") {
		throw new Error("[Weaver] acquireVsCodeApi is not available — not running in a VS Code webview.");
	}
	_api = acquireVsCodeApi();
	return _api;
}

export function postToExtension(msg: unknown): void {
	getVsCodeApi().postMessage(msg);
}

export function onExtensionMessage(handler: (msg: any) => void): () => void {
	const listener = (e: MessageEvent) => handler(e.data);
	window.addEventListener("message", listener);
	return () => window.removeEventListener("message", listener);
}
