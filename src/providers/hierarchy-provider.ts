import * as vscode from "vscode";
import type { EditorContext } from "../editor/editor-context";
import type { SceneDocument } from "../editor/scene-document";
import { Node } from "../scene/node";

type NodeTreeItem = {
	kind: "node";
	node: Node;
};

type RootItem = {
	kind: "root";
	scene: string;
};

type Item = NodeTreeItem | RootItem;

export class HierarchyProvider implements vscode.TreeDataProvider<Item> {
	private _onDidChangeTreeData = new vscode.EventEmitter<Item | undefined | void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	constructor(private readonly editor: EditorContext) {
		this.editor.selection.bus.on("changed", () => this.refresh());
		this.editor.bus.on("scene:loaded", () => this.refresh());
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

	getChildren(element?: Item): Item[] {
		if (!element) {
			return [{ kind: "root", scene: this.editor.scene.name }];
		}
		if (element.kind === "root") {
			return this.editor.scene.root.children.map((node) => ({ kind: "node", node }));
		}
		return element.node.children.map((node) => ({ kind: "node", node }));
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
