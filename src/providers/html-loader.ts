// src/providers/html-loader.ts
import * as fs from "node:fs";
import * as vscode from "vscode";

export type WebviewEntry = "inspector" | "viewport";

export function loadWebviewHtml(context: vscode.ExtensionContext, webview: vscode.Webview, entry: WebviewEntry): string {
	const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

	const baseDir = vscode.Uri.joinPath(context.extensionUri, "dist", "webview", entry);
	const htmlUri = vscode.Uri.joinPath(baseDir, "index.html");

	let html: string;
	try {
		html = fs.readFileSync(htmlUri.fsPath, "utf8");
	} catch (err) {
		return `<!DOCTYPE html><html><body style="color:#f66;font-family:monospace;padding:20px">
			Failed to load ${entry}: ${String(err)}
		</body></html>`;
	}

	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(baseDir, "index.js"));
	const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(baseDir, "index.css"));
	html = html.replace(/\{\{scriptUri\}\}/g, scriptUri.toString()).replace(/\{\{stylesUri\}\}/g, stylesUri.toString());

	return html.replace(/\{\{nonce\}\}/g, nonce).replace(/\{\{cspSource\}\}/g, webview.cspSource);
}
