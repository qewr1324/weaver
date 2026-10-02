// src/providers/inspector-provider.ts
import * as vscode from "vscode";
import { RenameNodeCommand, SetTransformCommand } from "../editor/commands";
import type { EditorContext, TransformSyncPayload } from "../editor/editor-context";
import { loadWebviewHtml } from "./html-loader";

export class InspectorProvider implements vscode.WebviewViewProvider {
	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly editor: EditorContext,
	) {}

	resolveWebviewView(view: vscode.WebviewView): void {
		view.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		};
		view.webview.html = loadWebviewHtml(this.context, view.webview, "inspector.html");

		let lastPushTime = 0;
		let pushTimer: ReturnType<typeof setTimeout> | null = null;

		const pushInspect = (force = false) => {
			const now = Date.now();
			// throttle: حداقل 30ms بین pushها
			if (!force && now - lastPushTime < 30) {
				if (pushTimer) clearTimeout(pushTimer);
				pushTimer = setTimeout(() => pushInspect(true), 30);
				return;
			}
			lastPushTime = now;

			const id = this.editor.selection.primary;
			const node = id ? this.editor.scene.findNode(id) : null;
			view.webview.postMessage({
				type: "inspect",
				payload: node
					? {
							id: node.id,
							name: node.name,
							enabled: node.enabled,
							transform: node.transform.toJSON(),
							components: node.components,
						}
					: null,
				multi: this.editor.selection.ids.length > 1,
				count: this.editor.selection.ids.length,
			});
		};

		// ─── sub: selection ───
		const selSub = this.editor.selection.bus.on("changed", () => pushInspect(true));
		const primarySub = this.editor.selection.bus.on("primaryChanged", () => pushInspect(true));

		// ─── sub: transform:changed → پل مستقیم از viewport ───
		const transformSub = this.editor.bus.on("transform:changed", (payload: TransformSyncPayload) => {
			// اگه منبع خود inspector بود، ignore کن (چون خودش می‌دونه)
			if (payload.source === "inspector") return;
			pushInspect(true);
		});

		// ─── sub: rename:changed ───
		const renameSub = this.editor.bus.on("rename:changed", () => pushInspect(true));

		// ─── sub: scene:loaded ───
		const sceneSub = this.editor.bus.on("scene:loaded", () => pushInspect(true));

		// ─── sub: پیام‌ها از webview ───
		const msgSub = view.webview.onDidReceiveMessage(async (msg) => {
			switch (msg.type) {
				case "update:transform": {
					const node = this.editor.scene.findNode(msg.nodeId);
					if (!node) return;
					if (typeof msg.value !== "number" || !Number.isFinite(msg.value)) return;
					await this.editor.commands.execute(
						new SetTransformCommand(node, msg.channel, msg.axis, msg.value, (n) => {
							// ─── خبر بده به viewport که از inspector اومده ───
							this.editor.notifyTransformChanged(n, "inspector");
						}),
					);
					break;
				}

				case "rename": {
					const node = this.editor.scene.findNode(msg.nodeId);
					if (!node) return;
					await this.editor.commands.execute(
						new RenameNodeCommand(node, msg.name, (n) => {
							this.editor.notifyRenamed(n);
						}),
					);
					break;
				}

				case "toggle:enabled": {
					const node = this.editor.scene.findNode(msg.nodeId);
					if (!node) return;
					node.enabled = !node.enabled;
					this.editor.bus.emit("scene:mutated", undefined);
					pushInspect(true);
					break;
				}
			}
		});

		view.onDidDispose(() => {
			selSub();
			primarySub();
			transformSub();
			renameSub();
			sceneSub();
			msgSub.dispose();
			if (pushTimer) clearTimeout(pushTimer);
		});

		pushInspect(true);
	}
}
