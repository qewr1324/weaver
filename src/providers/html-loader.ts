// src/providers/html-loader.ts
import * as fs from "node:fs";
import * as vscode from "vscode";

/**
 * اسم فایل‌هایی که می‌تونن لود بشن:
 *  - "inspector" → از dist/webview/inspector/index.html (bundled)
 *  - "viewport"  → از dist/webview/viewport/index.html (bundled)
 *  - "viewport.html" → از src/webview/viewport.html (legacy، هنوز bundle نشده)
 */
export type WebviewEntry = "inspector" | "viewport" | "viewport.html";

export function loadWebviewHtml(context: vscode.ExtensionContext, webview: vscode.Webview, entry: WebviewEntry): string {
	const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

	// ── آیا bundled هست؟ (inspector/viewport بدون .html) ──
	const isBundled = entry === "inspector" || entry === "viewport";

	const baseDir = isBundled ? vscode.Uri.joinPath(context.extensionUri, "dist", "webview", entry) : vscode.Uri.joinPath(context.extensionUri, "src", "webview");

	const htmlUri = isBundled ? vscode.Uri.joinPath(baseDir, "index.html") : vscode.Uri.joinPath(baseDir, entry); // مثلاً src/webview/viewport.html

	let html: string;
	try {
		html = fs.readFileSync(htmlUri.fsPath, "utf8");
	} catch (err) {
		return `<!DOCTYPE html><html><body style="color:#f66;font-family:monospace;padding:20px">
			Failed to load ${entry}: ${String(err)}
		</body></html>`;
	}

	// ── URIهای asset فقط برای bundled ──
	if (isBundled) {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(baseDir, "index.js"));
		const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(baseDir, "index.css"));
		html = html.replace(/\{\{scriptUri\}\}/g, scriptUri.toString()).replace(/\{\{stylesUri\}\}/g, stylesUri.toString());
	}

	return html.replace(/\{\{nonce\}\}/g, nonce).replace(/\{\{cspSource\}\}/g, webview.cspSource);
}
