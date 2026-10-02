// src/providers/hierarchy-provider.ts
import * as vscode from "vscode";
import * as path from "node:path";
import type { EditorContext } from "../editor/editor-context";
import type { Node } from "../scene/node";

type Item = { kind: "root"; scene: string } | { kind: "node"; node: Node } | { kind: "shader-section" } | { kind: "shader-file"; uri: vscode.Uri; name: string };

export class HierarchyProvider implements vscode.TreeDataProvider<Item> {
	private _onDidChangeTreeData = new vscode.EventEmitter<Item | undefined | void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private shaderFiles: vscode.Uri[] = [];

	constructor(private readonly editor: EditorContext) {
		this.editor.selection.bus.on("changed", () => this.refresh());
		this.editor.bus.on("scene:loaded", () => this.refresh());

		void this.scanShaders();

		vscode.workspace.onDidCreateFiles(() => void this.scanShaders().then(() => this.refresh()));
		vscode.workspace.onDidDeleteFiles(() => void this.scanShaders().then(() => this.refresh()));
		vscode.workspace.onDidRenameFiles(() => void this.scanShaders().then(() => this.refresh()));
	}

	private async scanShaders(): Promise<void> {
		try {
			this.shaderFiles = await vscode.workspace.findFiles("**/*.weave.shader.json", "**/node_modules/**", 200);
		} catch {
			this.shaderFiles = [];
		}
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: Item): vscode.TreeItem {
		if (element.kind === "root") {
			const item = new vscode.TreeItem(`🌍 ${element.scene}`, vscode.TreeItemCollapsibleState.Expanded);
			item.contextValue = "weaver.root";
			return item;
		}

		if (element.kind === "node") {
			const node = element.node;
			const hasChildren = node.children.length > 0;
			const item = new vscode.TreeItem(node.name, hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
			item.id = node.id;
			item.contextValue = "weaver.node";
			item.iconPath = this.iconFor(node);
			item.description = this.descFor(node);
			item.tooltip = `${node.name} (${node.id})`;

			if (this.editor.selection.has(node.id)) {
				item.resourceUri = vscode.Uri.parse("weaver-selected:/" + node.id);
			}

			item.command = {
				command: "weaver.selectNodeFromTree",
				title: "Select",
				arguments: [node.id],
			};

			return item;
		}

		if (element.kind === "shader-section") {
			const item = new vscode.TreeItem("Shaders", vscode.TreeItemCollapsibleState.Expanded);
			item.contextValue = "weaver.shader.section";
			item.iconPath = new vscode.ThemeIcon("symbol-color");
			return item;
		}

		// shader-file
		const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
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

	getChildren(element?: Item): Item[] {
		if (!element) {
			const items: Item[] = [{ kind: "root", scene: this.editor.scene.name }];
			if (this.shaderFiles.length > 0) {
				items.push({ kind: "shader-section" });
			}
			return items;
		}

		if (element.kind === "root") {
			return this.editor.scene.root.children.map((node) => ({ kind: "node", node }));
		}

		if (element.kind === "node") {
			return element.node.children.map((node) => ({ kind: "node", node }));
		}

		if (element.kind === "shader-section") {
			return this.shaderFiles.map((uri) => {
				const name = path.basename(uri.fsPath, ".weave.shader.json");
				return { kind: "shader-file" as const, uri, name };
			});
		}

		return [];
	}

	getParent(element: Item): Item | undefined {
		if (element.kind !== "node") return undefined;
		const parent = element.node.parent;
		if (!parent || parent.id === this.editor.scene.root.id) {
			return { kind: "root", scene: this.editor.scene.name };
		}
		return { kind: "node", node: parent };
	}

	private iconFor(node: Node): vscode.ThemeIcon {
		if (node.components.some((c) => c.type === "mesh")) return new vscode.ThemeIcon("symbol-structure");
		if (node.components.some((c) => c.type === "light")) return new vscode.ThemeIcon("lightbulb");
		if (node.components.some((c) => c.type === "camera")) return new vscode.ThemeIcon("device-camera");
		if (node.components.some((c) => c.type === "script")) return new vscode.ThemeIcon("code");
		return new vscode.ThemeIcon("symbol-misc");
	}

	private descFor(node: Node): string {
		const types = node.components.map((c) => c.type).join(", ");
		return types || "";
	}
}
