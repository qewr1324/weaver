import * as fs from "node:fs";
import * as vscode from "vscode";

export function loadWebviewHtml(context: vscode.ExtensionContext, webview: vscode.Webview, fileName: "viewport.html" | "inspector.html"): string {
	const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
	const uri = vscode.Uri.joinPath(context.extensionUri, "src", "webview", fileName);
	let html: string;
	try {
		html = fs.readFileSync(uri.fsPath, "utf8");
	} catch (err) {
		return `<!DOCTYPE html><html><body style="color:#f66;font-family:monospace;padding:20px">
      Failed to load ${fileName}: ${String(err)}
    </body></html>`;
	}
	return html.replace(/\{\{nonce\}\}/g, nonce).replace(/\{\{cspSource\}\}/g, webview.cspSource);
}
