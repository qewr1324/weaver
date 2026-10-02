// src/webview/shader/scripts/render/code-output.ts
import type { ShaderDefinition } from "../../../../scene/shader/types";
import { generateAll } from "../codegen";

export function renderCodeOutput(shader: ShaderDefinition): string {
	if (shader.output.targets.length === 0) {
		return `
			<div class="code-section">
				<div class="code-head">
					<span class="code-title">Generated Code</span>
				</div>
				<div class="code-empty">No output targets selected</div>
			</div>
		`;
	}

	const files = generateAll(shader);
	const fileNames = Object.keys(files);

	let html = `<div class="code-section">`;
	html += `<div class="code-head">`;
	html += `<span class="code-title">Generated Code</span>`;
	html += `<div class="code-actions">`;
	html += `<button class="code-btn" data-code-action="copy-all">Copy All</button>`;
	html += `<button class="code-btn primary" data-code-action="save-all">Save Files</button>`;
	html += `</div>`;
	html += `</div>`;

	// tabs
	html += `<div class="code-tabs">`;
	for (let i = 0; i < fileNames.length; i++) {
		const name = fileNames[i];
		html += `<button class="code-tab${i === 0 ? " active" : ""}" data-code-tab="${esc(name)}">${esc(name)}</button>`;
	}
	html += `</div>`;

	// panels
	html += `<div class="code-panels">`;
	for (let i = 0; i < fileNames.length; i++) {
		const name = fileNames[i];
		const content = files[name];
		html += `<div class="code-panel${i === 0 ? " active" : ""}" data-code-panel="${esc(name)}">`;
		html += `<div class="code-toolbar">`;
		html += `<button class="code-btn small" data-code-copy="${esc(name)}">Copy</button>`;
		html += `<span class="code-lines">${content.split("\n").length} lines</span>`;
		html += `</div>`;
		html += `<pre class="code-pre"><code>${highlightCode(content, name)}</code></pre>`;
		html += `</div>`;
	}
	html += `</div>`;

	html += `</div>`;
	return html;
}

function esc(s: string): string {
	return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * syntax highlighting ساده — فقط کامنت‌ها و keyword ها.
 */
function highlightCode(code: string, filename: string): string {
	// escape
	let html = esc(code);

	// comments (// ... و /* ... */)
	html = html.replace(/(\/\/[^\n]*)/g, `<span class="tk-comment">$1</span>`);
	html = html.replace(/(\/\*[\s\S]*?\*\/)/g, `<span class="tk-comment">$1</span>`);

	// strings
	html = html.replace(/(&quot;[^&]*?&quot;)/g, `<span class="tk-string">$1</span>`);

	// keywords
	const keywords = [
		"void",
		"float",
		"int",
		"bool",
		"vec2",
		"vec3",
		"vec4",
		"mat3",
		"mat4",
		"attribute",
		"varying",
		"uniform",
		"precision",
		"highp",
		"mediump",
		"lowp",
		"if",
		"else",
		"for",
		"return",
		"discard",
		"struct",
		"sampler2D",
		"const",
		"in",
		"out",
		"inout",
		"import",
		"from",
		"export",
		"class",
		"function",
		"new",
		"const",
		"let",
		"var",
		"public",
		"private",
		"static",
		"extends",
		"super",
		"this",
		"technique",
		"pass",
		"compile",
		"VertexShader",
		"PixelShader",
	];

	for (const kw of keywords) {
		const re = new RegExp(`\\b(${kw})\\b`, "g");
		html = html.replace(re, `<span class="tk-keyword">$1</span>`);
	}

	// numbers
	html = html.replace(/\b(\d+\.?\d*f?)\b/g, `<span class="tk-number">$1</span>`);

	return html;
}
