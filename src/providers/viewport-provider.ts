// src/providers/viewport-provider.ts
import * as vscode from "vscode";
import { ensureGlobalConfig, setGlobalConfig } from "../config/loader";
import { getDefaultSceneUri, sceneFileExists } from "../config/paths";
import { log } from "../core/logger";
import { AddNodeCommand, DuplicateNodeCommand, RemoveNodeCommand } from "../editor/commands";
import type { EditorContext, TransformSnapshot } from "../editor/editor-context";
import { SceneDocument } from "../editor/scene-document";
import { type Component, nextComponentId } from "../scene/components";
import { SceneFactory } from "../scene/factory";
import { Node } from "../scene/node";
import { Serializer } from "../scene/serializer";
import { loadWebviewHtml } from "./html-loader";

export class WeaverViewportProvider implements vscode.CustomTextEditorProvider {
	private docs = new Map<string, SceneDocument>();

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly editor: EditorContext,
	) {}

	async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
		panel.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		};
		panel.webview.html = loadWebviewHtml(this.context, panel.webview, "viewport");

		const initialScene = Serializer.tryDeserialize(document.getText());
		if (!initialScene.ok) {
			log.error("initial scene invalid:", initialScene.error);
			panel.webview.html = this.errorHtml(initialScene.error);
			return;
		}

		const doc = new SceneDocument(document.uri, initialScene.scene);
		const uriStr = document.uri.toString();
		this.docs.set(uriStr, doc);

		this.editor.attachDocument(doc);

		const post = (msg: unknown) => {
			try {
				panel.webview.postMessage(msg);
			} catch {
				/* ignore */
			}
		};

		const sendFullScene = () => {
			const resolved = doc.scene.resolvedConfig();
			if (!resolved) return;
			post({
				type: "scene:update",
				payload: { ...doc.scene.toJSON(), config: resolved },
			});
		};

		const changeSub = vscode.workspace.onDidChangeTextDocument((e) => {
			if (e.document.uri.toString() !== uriStr) return;
			doc.applyFromText(e.document.getText());
			sendFullScene();
		});

		const selSub = this.editor.selection.bus.on("changed", (ids) => {
			post({ type: "selection:update", ids });
		});

		const onNodeAdded = doc.scene.bus.on("node:added", () => sendFullScene());
		const onNodeRemoved = doc.scene.bus.on("node:removed", () => sendFullScene());
		const onSceneReloaded = doc.scene.bus.on("scene:reloaded", () => sendFullScene());

		// ⭐ transform از scene bus — echo از viewport رو skip کن
		const transformSub = doc.scene.bus.on("transform:changed", (payload) => {
			if (payload.source === "viewport") return;
			post({ type: "transform:apply", payload });
		});

		const renameSub = this.editor.bus.on("rename:changed", (payload) => {
			post({ type: "rename:apply", payload });
		});

		panel.onDidDispose(() => {
			changeSub.dispose();
			selSub();
			onNodeAdded();
			onNodeRemoved();
			onSceneReloaded();
			transformSub();
			renameSub();
			this.docs.delete(uriStr);
			this.editor.detachDocument(uriStr);
			doc.dispose();
		});

		let initialSent = false;

		panel.webview.onDidReceiveMessage(async (msg) => {
			try {
				switch (msg.type) {
					case "select":
						this.editor.selection.set(msg.ids ?? []);
						break;

					case "add:node":
						await this.handleAddNode(doc, msg.payload);
						break;

					case "remove:node":
						await this.handleRemoveNode(doc, msg.nodeId);
						break;

					case "duplicate:node":
						await this.handleDuplicateNode(doc, msg.nodeId);
						break;

					case "update:transform":
						await this.handleTransformFromViewport(doc, msg);
						break;

					case "ready":
						if (initialSent) return;
						initialSent = true;
						if (!doc.scene.resolvedConfig()) {
							const cfg = await ensureGlobalConfig(this.context);
							setGlobalConfig(cfg);
						}
						sendFullScene();
						break;
				}
			} catch (err) {
				log.error(`message handler failed for ${msg.type}:`, err);
			}
		});
	}

	async openDefaultScene(): Promise<void> {
		let uri: vscode.Uri;
		try {
			uri = getDefaultSceneUri();
		} catch (err) {
			vscode.window.showErrorMessage(String(err));
			return;
		}

		if (!(await sceneFileExists(uri))) {
			const scene = SceneFactory.createDefaultScene("Level 1");
			const json = Serializer.serialize(scene);
			await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(json));
			log.info("created default scene at " + uri.fsPath);
		}

		await vscode.commands.executeCommand("vscode.openWith", uri, "weaver.viewport");
	}

	async saveActiveScene(): Promise<{ ok: boolean; reason?: string }> {
		const activeTab = vscode.window.tabGroups.activeTabGroup?.activeTab;
		if (!activeTab) {
			const first = this.docs.values().next().value as SceneDocument | undefined;
			if (first) {
				await first.flushToDocument(true);
				return { ok: true };
			}
			return { ok: false, reason: "no active tab" };
		}

		let uri: vscode.Uri | undefined;
		if (activeTab.input instanceof vscode.TabInputCustom) uri = activeTab.input.uri;
		else if (activeTab.input instanceof vscode.TabInputText) uri = activeTab.input.uri;
		if (!uri) return { ok: false, reason: "active tab is not a file" };

		const doc = this.docs.get(uri.toString());
		if (!doc) return { ok: false, reason: "scene is not open in weaver viewport" };

		await doc.flushToDocument(true);
		return { ok: true };
	}

	private async handleTransformFromViewport(doc: SceneDocument, msg: any): Promise<void> {
		const node = doc.scene.findNode(msg.nodeId);
		if (!node) return;

		// ⭐ source رو از پیام بخون، نه hardcode
		const source: "viewport" | "inspector" = msg.source === "inspector" ? "inspector" : "viewport";

		let snapshot: TransformSnapshot;
		if (msg.transform) {
			// full transform (gizmo drag از viewport)
			snapshot = {
				position: { ...msg.transform.position },
				rotation: { ...msg.transform.rotation },
				scale: { ...msg.transform.scale },
			};
		} else {
			// single axis (inspector input)
			if (typeof msg.value !== "number" || !Number.isFinite(msg.value)) return;
			snapshot = {
				position: { ...node.transform.position },
				rotation: { ...node.transform.rotation },
				scale: { ...node.transform.scale },
			};
			(snapshot as any)[msg.channel][msg.axis] = msg.value;
		}

		this.editor.setNodeTransform(node, snapshot, source, msg.live === true);
	}

	private async handleAddNode(doc: SceneDocument, data: any): Promise<void> {
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
		await doc.commands.execute(new AddNodeCommand(doc.scene, newNode));
		this.editor.selection.set([newNode.id]);
	}

	private async handleRemoveNode(doc: SceneDocument, nodeId: string): Promise<void> {
		const node = doc.scene.findNode(nodeId);
		if (!node) return;
		await doc.commands.execute(new RemoveNodeCommand(doc.scene, node));
		this.editor.selection.remove(nodeId);
	}

	private async handleDuplicateNode(doc: SceneDocument, nodeId: string): Promise<void> {
		const node = doc.scene.findNode(nodeId);
		if (!node) return;
		await doc.commands.execute(new DuplicateNodeCommand(doc.scene, node, (s) => s.clone()));
		const parent = node.parent;
		if (parent) {
			const last = parent.children[parent.children.length - 1];
			if (last) this.editor.selection.set([last.id]);
		}
	}

	private errorHtml(message: string): string {
		return `<!DOCTYPE html><html><body style="color:#f66;font-family:monospace;padding:20px;background:#0D1117">
			<h3>Weaver: invalid scene file</h3>
			<pre>${message.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}</pre>
		</body></html>`;
	}
}
