import * as vscode from "vscode";
import { SetPropertyCommand } from "../editor/commands";
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

		this.editor.selection.bus.on("changed", (ids) => {
			const id = ids[0];
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
			});
		});

		view.webview.onDidReceiveMessage((msg) => {
			if (msg.type === "update:transform") {
				const node = this.editor.scene.findNode(msg.nodeId);
				if (!node) return;
				const { axis, channel, value } = msg;
				const target = node.transform[channel as "position" | "rotation" | "scale"] as any;
				const cmd = new SetPropertyCommand<number>(target, axis, value, `Set ${channel}.${axis}`);
				this.editor.commands.execute(cmd);
				this.editor.bus.emit("scene:mutated", undefined);
			}
		});
	}
}
