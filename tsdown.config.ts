// tsdown.config.ts
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { build as esbuild } from "esbuild";
import { defineConfig } from "tsdown";

const ROOT = process.cwd();
const DIST_WEBVIEW = join(ROOT, "dist", "webview");

interface WebviewTarget {
	name: string;
	scriptEntry: string;
	styleEntry: string;
	htmlFile: string;
}

const WEBVIEW_TARGETS: WebviewTarget[] = [
	{
		name: "inspector",
		scriptEntry: "src/webview/inspector/scripts/main.ts",
		styleEntry: "src/webview/inspector/styles/index.css",
		htmlFile: "src/webview/inspector/index.html",
	},
	{
		name: "viewport",
		scriptEntry: "src/webview/viewport/scripts/main.ts",
		styleEntry: "src/webview/viewport/styles/index.css",
		htmlFile: "src/webview/viewport/index.html",
	},
];

async function buildWebview(t: WebviewTarget): Promise<void> {
	const outDir = join(DIST_WEBVIEW, t.name);
	rmSync(outDir, { recursive: true, force: true });
	mkdirSync(outDir, { recursive: true });

	await esbuild({
		entryPoints: [t.scriptEntry],
		bundle: true,
		format: "iife",
		platform: "browser",
		target: "es2020",
		outfile: join(outDir, "index.js"),
		sourcemap: false,
		minify: false,
		logLevel: "warning",
	});

	await esbuild({
		entryPoints: [t.styleEntry],
		bundle: true,
		outfile: join(outDir, "index.css"),
		logLevel: "warning",
	});

	cpSync(t.htmlFile, join(outDir, "index.html"));

	console.log(`[weaver] webview built: ${t.name} → dist/webview/${t.name}/`);
}

export default defineConfig({
	entry: ["src/extension.ts"],
	format: ["cjs"],
	shims: false,
	dts: false,
	external: ["vscode"],
	clean: false,
	hooks(hooks) {
		hooks.hookOnce("build:prepare", async () => {
			for (const t of WEBVIEW_TARGETS) {
				await buildWebview(t);
			}
		});
	},
});
