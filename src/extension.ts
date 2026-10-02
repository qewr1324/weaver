// src/extension.ts
import * as vscode from "vscode";
import { registerCommands } from "./commands";
import { ensureGlobalConfig, setGlobalConfig } from "./config/loader";
import { LogLevel, Logger, log } from "./core/logger";
import { EditorContext } from "./editor/editor-context";
import { HierarchyProvider } from "./providers/hierarchy-provider";
import { InspectorProvider } from "./providers/inspector-provider";
import { WeaverViewportProvider } from "./providers/viewport-provider";

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

	// ─── refresh hooks ───
	editor.scene.bus.on("node:added", () => hierarchy.refresh());
	editor.scene.bus.on("node:removed", () => hierarchy.refresh());
	editor.bus.on("scene:loaded", () => hierarchy.refresh());

	// ─── Commands ───
	context.subscriptions.push(...registerCommands(context, editor, viewportProvider));

	log.info("Weaver activated ✓");
}

export function deactivate(): void {
	log.info("Weaver deactivated");
}
