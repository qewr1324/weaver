// src/webview/viewport/scripts/messaging/index.ts
type MessageHandler = (msg: any) => void;

interface VsCodeApi {
	postMessage(msg: unknown): void;
	getState<T = unknown>(): T | undefined;
	setState<T>(state: T): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let _api: VsCodeApi | null = null;

export function vscode(): VsCodeApi {
	if (_api) return _api;
	if (typeof acquireVsCodeApi !== "function") {
		throw new Error("[Weaver] acquireVsCodeApi is not available.");
	}
	_api = acquireVsCodeApi();
	return _api;
}

export function postToExtension(msg: unknown): void {
	vscode().postMessage(msg);
}

export function onExtensionMessage(handler: MessageHandler): () => void {
	const listener = (e: MessageEvent) => handler(e.data);
	window.addEventListener("message", listener);
	return () => window.removeEventListener("message", listener);
}
