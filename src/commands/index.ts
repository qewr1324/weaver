import * as vscode from "vscode";
import { createDefaultGlobalConfig } from "../config/defaults";
import { ensureGlobalConfig, getGlobalConfigUri, saveGlobalConfig, setGlobalConfig } from "../config/loader";
import type { EditorContext } from "../editor/editor-context";
import { SceneFactory } from "../scene/factory";
import { Serializer } from "../scene/serializer";

export function registerCommands(context: vscode.ExtensionContext, editor: EditorContext): vscode.Disposable[] {
	return [
		vscode.commands.registerCommand("weaver.newScene", async () => {
			const name = await vscode.window.showInputBox({
				prompt: "Scene name",
				placeHolder: "My Awesome Level",
				value: "New Scene",
				validateInput: (v) => (v.trim().length === 0 ? "Name cannot be empty" : null),
			});
			if (name === undefined) return;

			const safeName = name.trim().replace(/\s+/g, "-").toLowerCase();
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			const defaultUri = workspaceFolder ? vscode.Uri.joinPath(workspaceFolder.uri, `${safeName}.weave.json`) : vscode.Uri.file(`${safeName}.weave.json`);

			const uri = await vscode.window.showSaveDialog({
				filters: { "Weaver Scene": ["weave.json"] },
				saveLabel: "Create Scene",
				defaultUri,
			});
			if (uri === undefined) return;

			const scene = SceneFactory.createDefaultScene(name.trim());
			const json = Serializer.serialize(scene);

			await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(json));
			await vscode.commands.executeCommand("vscode.openWith", uri, "weaver.viewport");
			editor.loadScene(scene);
		}),

		vscode.commands.registerCommand("weaver.undo", () => editor.commands.undo()),
		vscode.commands.registerCommand("weaver.redo", () => editor.commands.redo()),

		vscode.commands.registerCommand("weaver.openConfig", async () => {
			await ensureGlobalConfig(context);
			const uri = getGlobalConfigUri(context);
			await vscode.window.showTextDocument(uri);
		}),

		vscode.commands.registerCommand("weaver.resetConfig", async () => {
			const defaultCfg = createDefaultGlobalConfig();
			await saveGlobalConfig(context, defaultCfg);
			setGlobalConfig(defaultCfg);
			vscode.window.showInformationMessage("Weaver config reset to defaults ✓");
			vscode.commands.executeCommand("workbench.action.webview.reloadWebviewAction");
		}),

		vscode.commands.registerCommand("weaver.revealConfig", async () => {
			await ensureGlobalConfig(context);
			const uri = getGlobalConfigUri(context);
			await vscode.commands.executeCommand("revealFileInOS", uri);
		}),
	];
}
