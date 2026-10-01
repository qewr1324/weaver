import * as vscode from "vscode";
import { ensureGlobalConfig, setGlobalConfig } from "../config/loader";
import type { WeaverConfig } from "../config/types";
import { log } from "../core/logger";
import { AddNodeCommand } from "../editor/commands";
import type { EditorContext } from "../editor/editor-context";
import { type Component, nextComponentId } from "../scene/components";
import { Node } from "../scene/node";
import { Serializer } from "../scene/serializer";
import { loadWebviewHtml } from "./html-loader";

export class WeaverViewportProvider implements vscode.CustomTextEditorProvider {
	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly editor: EditorContext,
	) {}

	async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
		panel.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		};
		panel.webview.html = loadWebviewHtml(this.context, panel.webview, "viewport.html");

		const send = () => {
			try {
				const scene = Serializer.deserialize(document.getText());
				this.editor.loadScene(scene);

				const resolved = scene.resolvedConfig();
				if (!resolved) {
					log.warn("global config not ready yet");
					return;
				}

				panel.webview.postMessage({
					type: "scene:update",
					payload: {
						...scene.toJSON(),
						config: resolved,
					},
				});
			} catch (err) {
				log.error("deserialize failed", err);
			}
		};

		const changeSub = vscode.workspace.onDidChangeTextDocument((e) => {
			if (e.document.uri.toString() === document.uri.toString()) send();
		});

		const selSub = this.editor.selection.bus.on("changed", (ids) => {
			panel.webview.postMessage({ type: "selection:update", ids });
		});

		panel.onDidDispose(() => {
			changeSub.dispose();
			selSub();
		});

		let initialSent = false;

		panel.webview.onDidReceiveMessage(async (msg) => {
			switch (msg.type) {
				case "select":
					this.editor.selection.set(msg.ids ?? []);
					break;

				case "add:node":
					await this.handleAddNode(document, msg.payload);
					break;

				case "update:transform":
					this.handleTransformUpdate(msg);
					break;

				case "config:update":
					await this.handleConfigUpdate(document, msg.payload, panel);
					break;

				case "ready":
					if (initialSent) return;
					initialSent = true;

					if (!this.editor.scene.resolvedConfig()) {
						const cfg = await ensureGlobalConfig(this.context);
						setGlobalConfig(cfg);
					}
					send();
					break;
			}
		});
	}

	private async handleAddNode(document: vscode.TextDocument, data: any): Promise<void> {
		try {
			const newNode = new Node(data.name);

			if (data.transform) {
				newNode.transform.position = { ...data.transform.position };
				newNode.transform.rotation = { ...data.transform.rotation };
				newNode.transform.scale = { ...data.transform.scale };
			}

			for (const c of data.components ?? []) {
				const { id: _ignore, ...rest } = c;
				newNode.addComponent({ id: nextComponentId(), ...rest } as Component);
			}

			this.editor.commands.execute(new AddNodeCommand(this.editor.scene, newNode));

			const updatedJson = Serializer.serialize(this.editor.scene);
			const edit = new vscode.WorkspaceEdit();
			edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), updatedJson);
			await vscode.workspace.applyEdit(edit);

			this.editor.selection.set([newNode.id]);
		} catch (err) {
			log.error("handleAddNode failed", err);
		}
	}

	private handleTransformUpdate(msg: any): void {
		try {
			const node = this.editor.scene.findNode(msg.nodeId);
			if (!node) return;

			const { axis, channel, value } = msg;
			const target = node.transform[channel as "position" | "rotation" | "scale"] as any;

			if (target && typeof value === "number") {
				target[axis] = value;
				this.editor.markDirty(true);
			}
		} catch (err) {
			log.error("handleTransformUpdate failed", err);
		}
	}

	private async handleConfigUpdate(document: vscode.TextDocument, payload: Partial<WeaverConfig>, panel: vscode.WebviewPanel): Promise<void> {
		try {
			this.editor.scene.config = payload;

			const updatedJson = JSON.stringify(
				{
					version: "1.0",
					name: this.editor.scene.name,
					config: this.editor.scene.config,
					root: this.editor.scene.root.toJSON(),
				},
				null,
				2,
			);

			const edit = new vscode.WorkspaceEdit();
			edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), updatedJson);
			await vscode.workspace.applyEdit(edit);

			const resolved = this.editor.scene.resolvedConfig();
			if (resolved) {
				panel.webview.postMessage({
					type: "config:resolved",
					payload: resolved,
				});
			}
		} catch (err) {
			log.error("handleConfigUpdate failed", err);
		}
	}
}
