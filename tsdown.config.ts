import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";
import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/extension.ts"],
	format: ["cjs"],
	shims: false,
	dts: false,
	external: ["vscode"],
	hooks(hooks) {
		hooks.hookOnce("build:prepare", () => {
			execFileSync("bun", ["run", "update"], { stdio: "inherit" });
		});

		// بعد از اینکه tsdown فایل .cjs رو ساخت، HTMLها رو کپی کن
		hooks.hookOnce("build:done", () => {
			mkdirSync("dist/webviews", { recursive: true });
			cpSync("src/webview/viewport.html", "dist/webview/viewport.html");
			cpSync("src/webview/inspector.html", "dist/webview/inspector.html");
			console.log("[weaver] webviews copied to dist/webviews/");
		});
	},
});
