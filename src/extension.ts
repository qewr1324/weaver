// src/extension.ts
import * as vscode from "vscode";
import { registerCommands } from "./commands";
import { ensureGlobalConfig, setGlobalConfig } from "./config/loader";
import { LogLevel, Logger, log } from "./core/logger";
import { EditorContext } from "./editor/editor-context";
import { HierarchyProvider } from "./providers/hierarchy-provider";
import { InspectorProvider } from "./providers/inspector-provider";
import { WeaverViewportProvider } from "./providers/viewport-provider";
import { WeaverShaderProvider } from "./providers/shader-provider";
import { ShaderTreeProvider } from "./providers/shader-tree-provider";

export function activate(context: vscode.ExtensionContext): void {
	log.info("Weaver activating...");
	Logger.setLevel(LogLevel.Debug);

	ensureGlobalConfig(context).then((cfg) => {
		setGlobalConfig(cfg);
		log.info("global config ready");
	});

	const editor = new EditorContext();
	context.subscriptions.push({ dispose: () => editor.dispose() });

	// ─── Viewport ───
	const viewportProvider = new WeaverViewportProvider(context, editor);
	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider("weaver.viewport", viewportProvider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	);

	// ─── Shader Editor ───
	const shaderProvider = new WeaverShaderProvider(context);
	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider("weaver.shader", shaderProvider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	);

	// ─── Inspector ───
	context.subscriptions.push(vscode.window.registerWebviewViewProvider("weaver.inspector", new InspectorProvider(context, editor)));

	// ─── Hierarchy TreeView ───
	const hierarchy = new HierarchyProvider(editor);
	context.subscriptions.push(
		vscode.window.createTreeView("weaver.hierarchy", {
			treeDataProvider: hierarchy,
			showCollapseAll: true,
		}),
	);

	// ─── Shader TreeView ───
	const shaderTree = new ShaderTreeProvider(context);
	const shaderTreeView = vscode.window.createTreeView("weaver.shader.explorer", {
		treeDataProvider: shaderTree,
		showCollapseAll: false,
	});
	context.subscriptions.push(shaderTreeView);

	// ─── refresh hooks ───
	editor.scene.bus.on("node:added", () => hierarchy.refresh());
	editor.scene.bus.on("node:removed", () => hierarchy.refresh());
	editor.bus.on("scene:loaded", () => hierarchy.refresh());

	// ✅ refresh shader tree وقتی فایل جدید ذخیره شد
	context.subscriptions.push(
		vscode.workspace.onDidCreateFiles(() => shaderTree.refresh()),
		vscode.workspace.onDidDeleteFiles(() => shaderTree.refresh()),
		vscode.workspace.onDidRenameFiles(() => shaderTree.refresh()),
	);

	// ─── Commands ───
	context.subscriptions.push(
		...registerCommands(context, editor, viewportProvider),
		vscode.commands.registerCommand("weaver.shader.new", () => WeaverShaderProvider.createNewShader(context)),
		vscode.commands.registerCommand("weaver.shader.refresh", () => shaderTree.refresh()),
		vscode.commands.registerCommand("weaver.shader.importFromClipboard", async () => {
			const text = await vscode.env.clipboard.readText();
			if (!text) {
				vscode.window.showWarningMessage("Weaver: clipboard is empty");
				return;
			}
			let parsed: unknown;
			try {
				parsed = JSON.parse(text);
			} catch {
				vscode.window.showErrorMessage("Weaver: clipboard does not contain valid JSON");
				return;
			}
			if (!parsed || typeof parsed !== "object" || !("channels" in parsed)) {
				vscode.window.showErrorMessage("Weaver: clipboard does not look like a shader");
				return;
			}

			const name = (parsed as any).name ?? "Imported Shader";
			const safeName = String(name).replace(/\s+/g, "-").toLowerCase();
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			const defaultUri = workspaceFolder ? vscode.Uri.joinPath(workspaceFolder.uri, `${safeName}.weave.shader.json`) : vscode.Uri.file(`${safeName}.weave.shader.json`);

			const uri = await vscode.window.showSaveDialog({
				filters: { "Weaver Shader": ["weave.shader.json"] },
				saveLabel: "Save Imported Shader",
				defaultUri,
			});
			if (!uri) return;

			await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text));
			await vscode.commands.executeCommand("vscode.openWith", uri, "weaver.shader");
			shaderTree.refresh();
		}),
	);

	log.info("Weaver activated ✓");
}

export function deactivate(): void {
	log.info("Weaver deactivated");
}
