// src/config/paths.ts
import * as vscode from "vscode";

/**
 * نام فایل پیش‌فرض scene که Weaver همیشه از روش می‌خونه و روش ذخیره می‌کنه.
 */
export const DEFAULT_SCENE_FILENAME = "level-1.weave.json";

/**
 * مسیر کامل فایل scene پیش‌فرض در workspace.
 * اگه workspace باز نباشه، throw می‌کنه.
 */
export function getDefaultSceneUri(): vscode.Uri {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		throw new Error("Weaver: no workspace folder is open.");
	}
	return vscode.Uri.joinPath(folder.uri, DEFAULT_SCENE_FILENAME);
}

/**
 * اگه فایل وجود داشته باشه true، وگرنه false.
 */
export async function sceneFileExists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch {
		return false;
	}
}
