import * as vscode from "vscode";
import { registerCommands } from "./commands";
import { ensureGlobalConfig, setGlobalConfig } from "./config/loader";
import { LogLevel, Logger, log } from "./core/logger";
import { EditorContext } from "./editor/editor-context";
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

	context.subscriptions.push(vscode.window.registerCustomEditorProvider("weaver.viewport", new WeaverViewportProvider(context, editor), { webviewOptions: { retainContextWhenHidden: true } }));

	context.subscriptions.push(vscode.window.registerWebviewViewProvider("weaver.inspector", new InspectorProvider(context, editor)));

	context.subscriptions.push(...registerCommands(context, editor));

	log.info("Weaver activated ✓");
}

export function deactivate(): void {
	log.info("Weaver deactivated");
}
