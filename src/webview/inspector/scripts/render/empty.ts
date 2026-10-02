// src/webview/inspector/scripts/render/empty.ts
export function renderEmpty(): string {
	return `<div class="empty">
		No selection<br/>
		<span style="font-size:11px;color:#484f58">
			Click a mesh in the viewport<br/>
			<kbd>Ctrl</kbd>+click to add to selection
		</span>
	</div>`;
}
