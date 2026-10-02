// src/providers/inspector-provider.ts
import * as vscode from "vscode";
import { RenameNodeCommand } from "../editor/commands";
import type { EditorContext } from "../editor/editor-context";
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

		const pushInspect = () => {
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

		const selSub = this.editor.selection.bus.on("changed", pushInspect);
		const primarySub = this.editor.selection.bus.on("primaryChanged", pushInspect);
		const sceneLoadedSub = this.editor.bus.on("scene:loaded", pushInspect);
		const sceneMutatedSub = this.editor.bus.on("scene:mutated", pushInspect);

		const transformSub = this.editor.scene.bus.on("transform:changed", (payload) => {
			if (payload.nodeId !== this.editor.selection.primary) return;
			if (payload.source === "inspector") return;
			pushInspect();
		});

		const renameSub = this.editor.bus.on("rename:changed", pushInspect);

		const msgSub = view.webview.onDidReceiveMessage(async (msg) => {
			switch (msg.type) {
				case "update:transform": {
					const node = this.editor.scene.findNode(msg.nodeId);
					if (!node) return;
					if (typeof msg.value !== "number" || !Number.isFinite(msg.value)) return;

					this.editor.setNodeTransformAxis(node, msg.channel, msg.axis, msg.value, "inspector");
					break;
				}

				case "rename": {
					const node = this.editor.scene.findNode(msg.nodeId);
					if (!node) return;
					await this.editor.commands.execute(new RenameNodeCommand(node, msg.name, (n) => this.editor.notifyRenamed(n)));
					break;
				}

				case "toggle:enabled": {
					const node = this.editor.scene.findNode(msg.nodeId);
					if (!node) return;
					node.enabled = !node.enabled;
					this.editor.bus.emit("scene:mutated", undefined);
					pushInspect();
					break;
				}
			}
		});

		view.onDidDispose(() => {
			selSub();
			primarySub();
			sceneLoadedSub();
			sceneMutatedSub();
			transformSub();
			renameSub();
			msgSub.dispose();
		});

		pushInspect();
	}
}
