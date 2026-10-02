// src/webview/shader/scripts/render/render-settings.ts
import type { ShaderDefinition } from "../../../../scene/shader/types";

export function renderRenderSettings(shader: ShaderDefinition): string {
	const r = shader.render;

	return `
		<div class="settings-section">
			<div class="settings-head">Render Settings</div>
			<div class="settings-body">
				<div class="setting-row">
					<label>Lighting</label>
					<select data-setting="lighting">
						<option value="unlit" ${r.lighting === "unlit" ? "selected" : ""}>Unlit</option>
						<option value="lit" ${r.lighting === "lit" ? "selected" : ""}>Lit</option>
						<option value="pbr" ${r.lighting === "pbr" ? "selected" : ""}>PBR</option>
					</select>
				</div>
				<div class="setting-row">
					<label>Alpha Mode</label>
					<select data-setting="alphaMode">
						<option value="opaque" ${r.alphaMode === "opaque" ? "selected" : ""}>Opaque</option>
						<option value="blend" ${r.alphaMode === "blend" ? "selected" : ""}>Blend</option>
						<option value="cutout" ${r.alphaMode === "cutout" ? "selected" : ""}>Cutout</option>
					</select>
				</div>
				<div class="setting-row">
					<label>Cull</label>
					<select data-setting="cull">
						<option value="back" ${r.cull === "back" ? "selected" : ""}>Back</option>
						<option value="front" ${r.cull === "front" ? "selected" : ""}>Front</option>
						<option value="none" ${r.cull === "none" ? "selected" : ""}>None</option>
					</select>
				</div>
				<div class="setting-row">
					<label>Double Sided</label>
					<input type="checkbox" data-setting="doubleSided" ${r.doubleSided ? "checked" : ""} />
				</div>
			</div>
		</div>
	`;
}
