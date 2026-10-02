// src/commands/index.ts
import * as vscode from "vscode";
import { createDefaultGlobalConfig } from "../config/defaults";
import { ensureGlobalConfig, getGlobalConfigUri, saveGlobalConfig, setGlobalConfig } from "../config/loader";
import type { EditorContext } from "../editor/editor-context";
import { DuplicateNodeCommand, RemoveNodeCommand, RenameNodeCommand } from "../editor/commands";
import { SceneFactory } from "../scene/factory";
import { Serializer } from "../scene/serializer";
import type { WeaverViewportProvider } from "../providers/viewport-provider";

export function registerCommands(context: vscode.ExtensionContext, editor: EditorContext, viewport: WeaverViewportProvider): vscode.Disposable[] {
	return [
		// ─────────────────────────────────────────
		// OPEN DEFAULT SCENE (level-1.weave.json)
		// ─────────────────────────────────────────
		vscode.commands.registerCommand("weaver.openDefaultScene", async () => {
			await viewport.openDefaultScene();
		}),

		// ─────────────────────────────────────────
		// NEW SCENE (با انتخاب نام و مسیر)
		// ─────────────────────────────────────────
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
		}),

		// ─────────────────────────────────────────
		// UNDO / REDO
		// ─────────────────────────────────────────
		vscode.commands.registerCommand("weaver.undo", () => editor.commands.undo()),
		vscode.commands.registerCommand("weaver.redo", () => editor.commands.redo()),

		// ─────────────────────────────────────────
		// SAVE
		// ─────────────────────────────────────────
		vscode.commands.registerCommand("weaver.saveScene", async () => {
			const result = await viewport.saveActiveScene();
			if (!result.ok) {
				vscode.window.showWarningMessage(`Weaver: cannot save — ${result.reason ?? "unknown"}`);
				return;
			}
			vscode.window.showInformationMessage("Weaver: scene saved ✓");
		}),

		// ─────────────────────────────────────────
		// SELECT FROM TREE
		// ─────────────────────────────────────────
		vscode.commands.registerCommand("weaver.selectNodeFromTree", (nodeId: string) => {
			editor.selection.set([nodeId]);
		}),

		// ─────────────────────────────────────────
		// DELETE SELECTED
		// ─────────────────────────────────────────
		vscode.commands.registerCommand("weaver.deleteSelected", async () => {
			const ids = editor.selection.ids;
			for (const id of ids) {
				const node = editor.scene.findNode(id);
				if (node) await editor.commands.execute(new RemoveNodeCommand(editor.scene, node));
			}
			editor.selection.clear();
		}),

		// ─────────────────────────────────────────
		// DUPLICATE SELECTED
		// ─────────────────────────────────────────
		vscode.commands.registerCommand("weaver.duplicateSelected", async () => {
			const ids = editor.selection.ids;
			const newIds: string[] = [];
			for (const id of ids) {
				const node = editor.scene.findNode(id);
				if (!node) continue;
				const cmd = new DuplicateNodeCommand(editor.scene, node, (src) => src.clone());
				await editor.commands.execute(cmd);
				const last = node.parent?.children[node.parent.children.length - 1];
				if (last) newIds.push(last.id);
			}
			editor.selection.set(newIds);
		}),

		// ─────────────────────────────────────────
		// RENAME SELECTED
		// ─────────────────────────────────────────
		vscode.commands.registerCommand("weaver.renameSelected", async () => {
			const id = editor.selection.primary;
			if (!id) return;
			const node = editor.scene.findNode(id);
			if (!node) return;

			const newName = await vscode.window.showInputBox({
				prompt: "New name",
				value: node.name,
			});
			if (newName === undefined) return;

			await editor.commands.execute(new RenameNodeCommand(node, newName));
		}),

		// ─────────────────────────────────────────
		// CONFIG
		// ─────────────────────────────────────────
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
