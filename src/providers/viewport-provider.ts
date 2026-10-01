import * as vscode from "vscode";
import { ensureGlobalConfig, setGlobalConfig } from "../config/loader";
import { log } from "../core/logger";
import { AddNodeCommand, DuplicateNodeCommand, RemoveNodeCommand, SetTransformCommand, SetWholeTransformCommand, type TransformSnapshot } from "../editor/commands";
import type { EditorContext } from "../editor/editor-context";
import { SceneDocument } from "../editor/scene-document";
import { type Component, nextComponentId } from "../scene/components";
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
		panel.webview.html = loadWebviewHtml(this.context, panel.webview, "viewport.html");

		// ─── ساخت SceneDocument اولیه ───
		const initialScene = Serializer.tryDeserialize(document.getText());
		if (!initialScene.ok) {
			log.error("initial scene invalid:", initialScene.error);
			panel.webview.html = this.errorHtml(initialScene.error);
			return;
		}

		const doc = new SceneDocument(document.uri, initialScene.scene);
		this.docs.set(document.uri.toString(), doc);
		this.editor.loadScene(doc.scene);

		const post = (msg: unknown) => {
			try {
				panel.webview.postMessage(msg);
			} catch {
				/* ignore */
			}
		};

		const sendScene = () => {
			const resolved = doc.scene.resolvedConfig();
			if (!resolved) {
				log.warn("global config not ready");
				return;
			}
			post({
				type: "scene:update",
				payload: { ...doc.scene.toJSON(), config: resolved },
			});
		};

		// ─── sub: فایل تغییر کرد → scene رو دوباره load کن ───
		const changeSub = vscode.workspace.onDidChangeTextDocument((e) => {
			if (e.document.uri.toString() !== document.uri.toString()) return;

			// ─── اگه خودمون داریم می‌نویسیم، ignore ───
			if (doc.writing) return;

			// ─── از فایل بخون و محتویات scene رو جایگزین کن ───
			doc.applyFromText(e.document.getText());
			sendScene();
		});

		// ─── sub: selection ───
		const selSub = this.editor.selection.bus.on("changed", (ids) => {
			post({ type: "selection:update", ids });
		});

		// ─── sub: scene mutated → flush به فایل (debounced) ───
		let flushTimer: NodeJS.Timeout | null = null;
		const mutatedSub = this.editor.scene.bus.on("scene:changed", () => {
			if (flushTimer) clearTimeout(flushTimer);
			flushTimer = setTimeout(() => {
				void doc.flushToDocument();
			}, 150);
		});

		panel.onDidDispose(() => {
			changeSub.dispose();
			selSub();
			mutatedSub();
			if (flushTimer) clearTimeout(flushTimer);
			this.docs.delete(document.uri.toString());
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
						if (msg.transform) {
							await this.handleWholeTransform(doc, msg.nodeId, msg.transform);
						} else {
							await this.handleAxisTransform(doc, msg.nodeId, msg.channel, msg.axis, msg.value);
						}
						break;

					case "ready":
						if (initialSent) return;
						initialSent = true;

						if (!doc.scene.resolvedConfig()) {
							const cfg = await ensureGlobalConfig(this.context);
							setGlobalConfig(cfg);
						}
						sendScene();
						break;
				}
			} catch (err) {
				log.error(`message handler failed for ${msg.type}:`, err);
			}
		});
	}

	/**
	 * ذخیره‌ی فایل فعال (چه Custom Editor چه Text Editor).
	 * از `tabGroups` استفاده می‌کنه چون `activeTextEditor` برای Custom Editorها undefined هست.
	 */
	async saveActiveScene(): Promise<{ ok: boolean; reason?: string }> {
		const activeTab = vscode.window.tabGroups.activeTabGroup?.activeTab;
		if (!activeTab) return { ok: false, reason: "no active tab" };

		let uri: vscode.Uri | undefined;
		if (activeTab.input instanceof vscode.TabInputCustom) {
			uri = activeTab.input.uri;
		} else if (activeTab.input instanceof vscode.TabInputText) {
			uri = activeTab.input.uri;
		}

		if (!uri) return { ok: false, reason: "active tab is not a file" };

		const doc = this.docs.get(uri.toString());
		if (!doc) return { ok: false, reason: "scene is not open in weaver viewport" };

		await doc.flushToDocument(true);
		return { ok: true };
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

		await this.editor.commands.execute(new AddNodeCommand(this.editor.scene, newNode));
		this.editor.selection.set([newNode.id]);
	}

	private async handleRemoveNode(doc: SceneDocument, nodeId: string): Promise<void> {
		const node = doc.scene.findNode(nodeId);
		if (!node) return;
		await this.editor.commands.execute(new RemoveNodeCommand(doc.scene, node));
		this.editor.selection.remove(nodeId);
	}

	private async handleDuplicateNode(doc: SceneDocument, nodeId: string): Promise<void> {
		const node = doc.scene.findNode(nodeId);
		if (!node) return;

		const cmd = new DuplicateNodeCommand(doc.scene, node, (src) => src.clone());
		await this.editor.commands.execute(cmd);

		const parent = node.parent;
		if (parent) {
			const last = parent.children[parent.children.length - 1];
			if (last) this.editor.selection.set([last.id]);
		}
	}

	private async handleWholeTransform(doc: SceneDocument, nodeId: string, transform: TransformSnapshot): Promise<void> {
		const node = doc.scene.findNode(nodeId);
		if (!node) return;
		await this.editor.commands.execute(new SetWholeTransformCommand(node, transform));
	}

	private async handleAxisTransform(doc: SceneDocument, nodeId: string, channel: string, axis: string, value: number): Promise<void> {
		const node = doc.scene.findNode(nodeId);
		if (!node || typeof value !== "number") return;
		await this.editor.commands.execute(new SetTransformCommand(node, channel as any, axis as any, value));
	}

	private errorHtml(message: string): string {
		return `<!DOCTYPE html><html><body style="color:#f66;font-family:monospace;padding:20px;background:#0D1117">
			<h3>Weaver: invalid scene file</h3>
			<pre>${message.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}</pre>
		</body></html>`;
	}
}
