import * as vscode from "vscode";
import { log } from "../core/logger";
import { createDefaultGlobalConfig } from "./defaults";
import { validateConfig } from "./schema";
import type { WeaverConfig } from "./types";

const CONFIG_FILENAME = "weaver.config.json";

let GLOBAL_CONFIG: WeaverConfig | null = null;

export function getGlobalConfig(): WeaverConfig | null {
	return GLOBAL_CONFIG;
}

export function setGlobalConfig(cfg: WeaverConfig): void {
	GLOBAL_CONFIG = cfg;
}

export function getGlobalConfigUri(context: vscode.ExtensionContext): vscode.Uri {
	return vscode.Uri.joinPath(context.globalStorageUri, CONFIG_FILENAME);
}

export async function ensureGlobalConfig(context: vscode.ExtensionContext): Promise<WeaverConfig> {
	const uri = getGlobalConfigUri(context);

	try {
		await vscode.workspace.fs.createDirectory(context.globalStorageUri);
	} catch {
		/* ignore */
	}

	try {
		const raw = await vscode.workspace.fs.readFile(uri);
		const parsed = JSON.parse(new TextDecoder().decode(raw));
		const validated = validateConfig(parsed);

		if (!validated.ok) {
			log.warn("global config invalid, using defaults. errors:", validated.errors);
			vscode.window.showWarningMessage(`Weaver: config file has ${validated.errors.length} issue(s). Using defaults.`);
			return createDefaultGlobalConfig();
		}

		log.info("global config loaded from " + uri.fsPath);
		return validated.data as WeaverConfig;
	} catch {
		log.info("global config not found — creating default at " + uri.fsPath);
		const defaultCfg = createDefaultGlobalConfig();
		await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(JSON.stringify(defaultCfg, null, 2)));
		return defaultCfg;
	}
}

export async function saveGlobalConfig(context: vscode.ExtensionContext, cfg: WeaverConfig): Promise<void> {
	const uri = getGlobalConfigUri(context);
	await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(JSON.stringify(cfg, null, 2)));
	log.info("global config saved to " + uri.fsPath);
}
