import * as vscode from "vscode";
import { RenameNodeCommand, SetTransformCommand } from "../editor/commands";
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

		view.onDidDispose(() => {
			selSub();
			primarySub();
		});

		view.webview.onDidReceiveMessage(async (msg) => {
			switch (msg.type) {
				case "update:transform": {
					const node = this.editor.scene.findNode(msg.nodeId);
					if (!node) return;
					await this.editor.commands.execute(new SetTransformCommand(node, msg.channel, msg.axis, msg.value));
					break;
				}

				case "rename": {
					const node = this.editor.scene.findNode(msg.nodeId);
					if (!node) return;
					await this.editor.commands.execute(new RenameNodeCommand(node, msg.name));
					break;
				}

				case "toggle:enabled": {
					const node = this.editor.scene.findNode(msg.nodeId);
					if (!node) return;
					node.enabled = !node.enabled;
					this.editor.bus.emit("scene:mutated", undefined);
					break;
				}
			}
		});

		// push اولیه
		pushInspect();
	}
}
