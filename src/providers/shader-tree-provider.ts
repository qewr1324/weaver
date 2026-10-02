// src/providers/shader-tree-provider.ts
import * as vscode from "vscode";
import * as path from "node:path";

export interface ShaderFileItem {
	kind: "shader";
	uri: vscode.Uri;
	name: string;
}

export interface ShaderActionItem {
	kind: "action";
	id: string;
	label: string;
	icon: string;
	command: string;
}

export interface ShaderEmptyItem {
	kind: "empty";
	label: string;
}

export type ShaderTreeItem = ShaderFileItem | ShaderActionItem | ShaderEmptyItem;

export class ShaderTreeProvider implements vscode.TreeDataProvider<ShaderTreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<ShaderTreeItem | undefined | void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private shaders: vscode.Uri[] = [];

	constructor(private readonly context: vscode.ExtensionContext) {
		this.refresh();
	}

	refresh(): void {
		void this.scanShaders();
		this._onDidChangeTreeData.fire();
	}

	private async scanShaders(): Promise<void> {
		try {
			const files = await vscode.workspace.findFiles("**/*.weave.shader.json", "**/node_modules/**", 200);
			this.shaders = files;
		} catch {
			this.shaders = [];
		}
	}

	getTreeItem(element: ShaderTreeItem): vscode.TreeItem {
		if (element.kind === "shader") {
			const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
			item.resourceUri = element.uri;
			item.contextValue = "weaver.shader.file";
			item.iconPath = new vscode.ThemeIcon("symbol-color");
			item.tooltip = element.uri.fsPath;
			item.command = {
				command: "vscode.openWith",
				title: "Open Shader",
				arguments: [element.uri, "weaver.shader"],
			};
			return item;
		}

		if (element.kind === "action") {
			const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
			item.contextValue = "weaver.shader.action";
			item.iconPath = new vscode.ThemeIcon(element.icon);
			item.command = {
				command: element.command,
				title: element.label,
			};
			return item;
		}

		// empty
		const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
		item.contextValue = "weaver.shader.empty";
		item.iconPath = new vscode.ThemeIcon("info");
		return item;
	}

	getChildren(element?: ShaderTreeItem): ShaderTreeItem[] {
		if (element) return [];

		const items: ShaderTreeItem[] = [];

		// actions
		items.push({
			kind: "action",
			id: "new",
			label: "New Shader…",
			icon: "add",
			command: "weaver.shader.new",
		});
		items.push({
			kind: "action",
			id: "import",
			label: "Import from Clipboard",
			icon: "clippy",
			command: "weaver.shader.importFromClipboard",
		});

		// shaders
		if (this.shaders.length === 0) {
			items.push({
				kind: "empty",
				label: "No shaders found",
			});
		} else {
			for (const uri of this.shaders) {
				const fileName = path.basename(uri.fsPath, ".weave.shader.json");
				items.push({
					kind: "shader",
					uri,
					name: fileName,
				});
			}
		}

		return items;
	}
}
