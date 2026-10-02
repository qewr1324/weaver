// src/providers/shader-provider.ts
import * as vscode from "vscode";
import { log } from "../core/logger";
import { createDefaultShader, ShaderSerializer } from "../scene/shader/serializer";
import type { ShaderDefinition } from "../scene/shader/types";
import { loadWebviewHtml } from "./html-loader";

export class WeaverShaderProvider implements vscode.CustomTextEditorProvider {
	private docs = new Map<string, ShaderDefinition>();

	constructor(private readonly context: vscode.ExtensionContext) {}

	async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
		panel.webview.options = {
			enableScripts: true,
			localResourceRoots: [this.context.extensionUri],
		};
		panel.webview.html = loadWebviewHtml(this.context, panel.webview, "shader");

		const initial = ShaderSerializer.tryDeserialize(document.getText());
		if (!initial.ok) {
			log.error("initial shader invalid:", initial.error);
			panel.webview.html = this.errorHtml(initial.error);
			return;
		}

		const uriStr = document.uri.toString();
		this.docs.set(uriStr, initial.shader);

		const post = (msg: unknown) => {
			try {
				panel.webview.postMessage(msg);
			} catch {
				/* ignore */
			}
		};

		const sendShader = () => {
			const shader = this.docs.get(uriStr);
			if (!shader) return;
			post({ type: "shader:update", payload: shader });
		};

		// ─── file changes → webview ───
		const changeSub = vscode.workspace.onDidChangeTextDocument((e) => {
			if (e.document.uri.toString() !== uriStr) return;
			const parsed = ShaderSerializer.tryDeserialize(e.document.getText());
			if (!parsed.ok) return;
			this.docs.set(uriStr, parsed.shader);
			sendShader();
		});

		panel.onDidDispose(() => {
			changeSub.dispose();
			this.docs.delete(uriStr);
		});

		let initialSent = false;

		panel.webview.onDidReceiveMessage(async (msg) => {
			try {
				switch (msg.type) {
					case "shader:update": {
						const shader = msg.payload as ShaderDefinition;
						this.docs.set(uriStr, shader);
						await this.writeToDocument(document, shader);
						break;
					}

					case "shader:save-files": {
						await this.saveGeneratedFiles(document.uri, msg.shaderName as string, msg.files as Record<string, string>);
						break;
					}

					case "shader:duplicate": {
						await this.duplicateShader(document.uri, msg.payload as ShaderDefinition);
						break;
					}

					case "ready":
						if (initialSent) return;
						initialSent = true;
						sendShader();
						break;
				}
			} catch (err) {
				log.error(`shader message handler failed for ${msg.type}:`, err);
			}
		});
	}

	private async writeToDocument(document: vscode.TextDocument, shader: ShaderDefinition): Promise<void> {
		const json = ShaderSerializer.serialize(shader);
		if (json === document.getText()) return;

		const edit = new vscode.WorkspaceEdit();
		const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
		edit.replace(document.uri, fullRange, json);
		await vscode.workspace.applyEdit(edit);
	}

	private async saveGeneratedFiles(shaderUri: vscode.Uri, shaderName: string, files: Record<string, string>): Promise<void> {
		const safeName = shaderName.replace(/[^a-zA-Z0-9-_]/g, "_");
		const folder = vscode.Uri.joinPath(shaderUri, "..", `${safeName}_generated`);

		try {
			await vscode.workspace.fs.createDirectory(folder);
		} catch {
			/* ignore */
		}

		const uris: vscode.Uri[] = [];

		for (const [name, content] of Object.entries(files)) {
			const fileUri = vscode.Uri.joinPath(folder, name);
			await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(content));
			uris.push(fileUri);
		}

		if (uris.length > 0) {
			await vscode.commands.executeCommand("revealFileInOS", folder);
			vscode.window.showInformationMessage(`Weaver: saved ${uris.length} file(s) to ${folder.fsPath}`);
		}
	}

	private async duplicateShader(sourceUri: vscode.Uri, shader: ShaderDefinition): Promise<void> {
		const safeName = shader.name.replace(/[^a-zA-Z0-9-_]/g, "_").toLowerCase();
		const folder = vscode.Uri.joinPath(sourceUri, "..");
		const newUri = vscode.Uri.joinPath(folder, `${safeName}.weave.shader.json`);

		let finalUri = newUri;
		let counter = 1;
		while (await this.fileExists(finalUri)) {
			finalUri = vscode.Uri.joinPath(folder, `${safeName}-${counter}.weave.shader.json`);
			counter++;
		}

		const json = ShaderSerializer.serialize(shader);
		await vscode.workspace.fs.writeFile(finalUri, new TextEncoder().encode(json));
		await vscode.commands.executeCommand("vscode.openWith", finalUri, "weaver.shader");
		vscode.window.showInformationMessage(`Weaver: duplicated shader → ${finalUri.fsPath}`);
	}

	private async fileExists(uri: vscode.Uri): Promise<boolean> {
		try {
			await vscode.workspace.fs.stat(uri);
			return true;
		} catch {
			return false;
		}
	}

	static async createNewShader(context: vscode.ExtensionContext): Promise<void> {
		const name = await vscode.window.showInputBox({
			prompt: "Shader name",
			placeHolder: "My Shader",
			value: "New Shader",
			validateInput: (v) => (v.trim().length === 0 ? "Name cannot be empty" : null),
		});
		if (name === undefined) return;

		const safeName = name.trim().replace(/\s+/g, "-").toLowerCase();
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		const defaultUri = workspaceFolder ? vscode.Uri.joinPath(workspaceFolder.uri, `${safeName}.weave.shader.json`) : vscode.Uri.file(`${safeName}.weave.shader.json`);

		const uri = await vscode.window.showSaveDialog({
			filters: { "Weaver Shader": ["weave.shader.json"] },
			saveLabel: "Create Shader",
			defaultUri,
		});
		if (uri === undefined) return;

		const shader = createDefaultShader(name.trim());
		const json = ShaderSerializer.serialize(shader);

		await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(json));
		await vscode.commands.executeCommand("vscode.openWith", uri, "weaver.shader");
	}

	private errorHtml(message: string): string {
		return `<!DOCTYPE html><html><body style="color:#f66;font-family:monospace;padding:20px;background:#0D1117">
			<h3>Weaver: invalid shader file</h3>
			<pre>${message.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}</pre>
		</body></html>`;
	}
}
