// src/webview/shader/scripts/preview/shaders.ts
import type { ShaderDefinition, ShaderChannelKey } from "../../../../scene/shader/types";
import { CHANNEL_ORDER } from "../../../../scene/shader/defaults";

/**
 * تولید vertex shader ساده.
 */
export function generateVertexShader(): string {
	return `
		precision highp float;

		attribute vec3 aPosition;
		attribute vec3 aNormal;
		attribute vec2 aUV;

		uniform mat4 uProjection;
		uniform mat4 uView;
		uniform mat4 uModel;
		uniform mat3 uNormalMatrix;

		varying vec3 vWorldPos;
		varying vec3 vNormal;
		varying vec2 vUV;

		void main() {
			vec4 worldPos = uModel * vec4(aPosition, 1.0);
			vWorldPos = worldPos.xyz;

			vNormal = normalize(uNormalMatrix * aNormal);
			vUV = aUV;

			gl_Position = uProjection * uView * worldPos;
		}
	`;
}

/**
 * تولید fragment shader بر اساس کانال‌های فعال.
 */
export function generateFragmentShader(shader: ShaderDefinition): string {
	const lines: string[] = [];

	lines.push("precision highp float;");
	lines.push("");

	// ─── varyings ───
	lines.push("varying vec3 vWorldPos;");
	lines.push("varying vec3 vNormal;");
	lines.push("varying vec2 vUV;");
	lines.push("");

	// ─── uniforms (camera + light) ───
	lines.push("uniform vec3 uCameraPos;");
	lines.push("uniform vec3 uLightDir;");
	lines.push("uniform vec3 uLightColor;");
	lines.push("uniform float uLightIntensity;");
	lines.push("");

	// ─── per-channel uniforms ───
	for (const key of CHANNEL_ORDER) {
		const ch = shader.channels[key];
		if (!ch.enabled) continue;

		const usesColor = ch.source === "color" || ch.source === "color-texture";
		const usesNumber = ch.source === "number" || ch.source === "number-texture";
		const usesTexture = ch.source === "texture" || ch.source === "color-texture" || ch.source === "number-texture";

		if (usesColor) {
			lines.push(`uniform vec4 u_${key}_color;`);
		}
		if (usesNumber) {
			lines.push(`uniform float u_${key}_number;`);
		}
		if (usesTexture) {
			lines.push(`uniform sampler2D u_${key}_texture;`);
			lines.push(`uniform bool u_${key}_hasTexture;`);
		}
		if (ch.source === "color-texture" || ch.source === "number-texture") {
			lines.push(`uniform float u_${key}_intensity;`);
		}
	}
	lines.push("");

	// ─── helper: sample texture safely ───
	lines.push(`
		vec4 sampleChannel_tex(sampler2D tex, bool has, vec4 fallback) {
			if (!has) return fallback;
			return texture2D(tex, vUV);
		}
	`);
	lines.push("");

	// ─── main ───
	lines.push("void main() {");

	// ─── N ───
	lines.push(`
		vec3 N = normalize(vNormal);
		vec3 V = normalize(uCameraPos - vWorldPos);
		vec3 L = normalize(-uLightDir);
	`);

	// ─── base color ───
	const bc = shader.channels.baseColor;
	if (bc.enabled) {
		if (bc.source === "color") {
			lines.push(`vec4 baseColor = u_baseColor_color;`);
		} else if (bc.source === "texture") {
			lines.push(`vec4 baseColor = sampleChannel_tex(u_baseColor_texture, u_baseColor_hasTexture, vec4(1.0));`);
		} else if (bc.source === "color-texture") {
			lines.push(`vec4 baseColor = u_baseColor_color * sampleChannel_tex(u_baseColor_texture, u_baseColor_hasTexture, vec4(1.0)) * u_baseColor_intensity;`);
		} else {
			lines.push(`vec4 baseColor = vec4(1.0);`);
		}
	} else {
		lines.push(`vec4 baseColor = vec4(1.0);`);
	}

	// ─── roughness ───
	const rg = shader.channels.roughness;
	if (rg.enabled) {
		if (rg.source === "number") {
			lines.push(`float roughness = u_roughness_number;`);
		} else if (rg.source === "texture") {
			lines.push(`float roughness = sampleChannel_tex(u_roughness_texture, u_roughness_hasTexture, vec4(0.5)).r;`);
		} else if (rg.source === "number-texture") {
			lines.push(`float roughness = u_roughness_number * sampleChannel_tex(u_roughness_texture, u_roughness_hasTexture, vec4(1.0)).r * u_roughness_intensity;`);
		} else {
			lines.push(`float roughness = 0.5;`);
		}
	} else {
		lines.push(`float roughness = 0.5;`);
	}

	// ─── metallic ───
	const mt = shader.channels.metallic;
	if (mt.enabled) {
		if (mt.source === "number") {
			lines.push(`float metallic = u_metallic_number;`);
		} else if (mt.source === "texture") {
			lines.push(`float metallic = sampleChannel_tex(u_metallic_texture, u_metallic_hasTexture, vec4(0.0)).r;`);
		} else if (mt.source === "number-texture") {
			lines.push(`float metallic = u_metallic_number * sampleChannel_tex(u_metallic_texture, u_metallic_hasTexture, vec4(1.0)).r * u_metallic_intensity;`);
		} else {
			lines.push(`float metallic = 0.0;`);
		}
	} else {
		lines.push(`float metallic = 0.0;`);
	}

	// ─── emissive ───
	const em = shader.channels.emissive;
	let hasEmissive = false;
	if (em.enabled) {
		if (em.source === "color") {
			lines.push(`vec3 emissive = u_emissive_color.rgb * u_emissive_color.a;`);
			hasEmissive = true;
		} else if (em.source === "texture") {
			lines.push(`vec3 emissive = sampleChannel_tex(u_emissive_texture, u_emissive_hasTexture, vec4(0.0)).rgb;`);
			hasEmissive = true;
		} else if (em.source === "color-texture") {
			lines.push(`vec3 emissive = u_emissive_color.rgb * sampleChannel_tex(u_emissive_texture, u_emissive_hasTexture, vec4(1.0)).rgb * u_emissive_intensity;`);
			hasEmissive = true;
		}
	}
	if (!hasEmissive) {
		lines.push(`vec3 emissive = vec3(0.0);`);
	}

	// ─── AO ───
	const ao = shader.channels.ao;
	let hasAO = false;
	if (ao.enabled && ao.source === "texture") {
		lines.push(`float ao = sampleChannel_tex(u_ao_texture, u_ao_hasTexture, vec4(1.0)).r;`);
		hasAO = true;
	}
	if (!hasAO) {
		lines.push(`float ao = 1.0;`);
	}

	// ─── specular ───
	const sp = shader.channels.specular;
	let hasSpec = false;
	if (sp.enabled) {
		if (sp.source === "number") {
			lines.push(`float specular = u_specular_number;`);
			hasSpec = true;
		} else if (sp.source === "texture") {
			lines.push(`float specular = sampleChannel_tex(u_specular_texture, u_specular_hasTexture, vec4(0.5)).r;`);
			hasSpec = true;
		} else if (sp.source === "number-texture") {
			lines.push(`float specular = u_specular_number * sampleChannel_tex(u_specular_texture, u_specular_hasTexture, vec4(1.0)).r * u_specular_intensity;`);
			hasSpec = true;
		}
	}
	if (!hasSpec) {
		lines.push(`float specular = 0.5;`);
	}

	// ─── opacity ───
	const op = shader.channels.opacity;
	let hasOpacity = false;
	if (op.enabled) {
		if (op.source === "number") {
			lines.push(`float opacity = u_opacity_number;`);
			hasOpacity = true;
		} else if (op.source === "texture") {
			lines.push(`float opacity = sampleChannel_tex(u_opacity_texture, u_opacity_hasTexture, vec4(1.0)).a;`);
			hasOpacity = true;
		} else if (op.source === "number-texture") {
			lines.push(`float opacity = u_opacity_number * sampleChannel_tex(u_opacity_texture, u_opacity_hasTexture, vec4(1.0)).a * u_opacity_intensity;`);
			hasOpacity = true;
		}
	}
	if (!hasOpacity) {
		lines.push(`float opacity = 1.0;`);
	}

	// ─── lighting ───
	const lighting = shader.render.lighting;
	lines.push("");
	lines.push("// ─── lighting ───");

	if (lighting === "unlit") {
		lines.push(`
			vec3 finalColor = baseColor.rgb * ao + emissive;
		`);
	} else if (lighting === "lit") {
		lines.push(`
			float NdotL = max(dot(N, L), 0.0);
			vec3 diffuse = baseColor.rgb * NdotL * uLightColor * uLightIntensity * ao;

			// simple blinn-phong specular
			vec3 H = normalize(L + V);
			float NdotH = max(dot(N, H), 0.0);
			float shininess = mix(8.0, 256.0, 1.0 - roughness);
			float spec = pow(NdotH, shininess) * specular;

			vec3 ambient = baseColor.rgb * 0.15 * ao;
			vec3 finalColor = ambient + diffuse + spec * uLightColor + emissive;
		`);
	} else {
		// pbr (simple)
		lines.push(`
			float NdotL = max(dot(N, L), 0.0);
			float NdotV = max(dot(N, V), 0.001);

			vec3 F0 = mix(vec3(0.04), baseColor.rgb, metallic);

			// fresnel
			vec3 H = normalize(L + V);
			float NdotH = max(dot(N, H), 0.0);
			float VdotH = max(dot(V, H), 0.0);
			vec3 F = F0 + (1.0 - F0) * pow(1.0 - VdotH, 5.0);

			// geometry
			float alpha = roughness * roughness;
			float k = alpha / 2.0;
			float G1L = NdotL / (NdotL * (1.0 - k) + k);
			float G1V = NdotV / (NdotV * (1.0 - k) + k);
			float G = G1L * G1V;

			// distribution
			float alpha2 = alpha * alpha;
			float denom = NdotH * NdotH * (alpha2 - 1.0) + 1.0;
			float D = alpha2 / (3.14159265 * denom * denom);

			vec3 specularBRDF = (F * G * D) / max(4.0 * NdotL * NdotV, 0.001);
			vec3 kD = (1.0 - F) * (1.0 - metallic);

			vec3 diffuse = kD * baseColor.rgb / 3.14159265;
			vec3 lighting = (diffuse + specularBRDF) * uLightColor * uLightIntensity * NdotL;

			vec3 ambient = baseColor.rgb * 0.1 * ao;
			vec3 finalColor = ambient + lighting * ao * specular + emissive;
		`);
	}

	// ─── output ───
	const alphaMode = shader.render.alphaMode;
	lines.push("");
	lines.push("// ─── output ───");

	if (alphaMode === "blend") {
		lines.push(`gl_FragColor = vec4(finalColor, baseColor.a * opacity);`);
	} else if (alphaMode === "cutout") {
		lines.push(`
			if (baseColor.a * opacity < 0.5) discard;
			gl_FragColor = vec4(finalColor, 1.0);
		`);
	} else {
		lines.push(`gl_FragColor = vec4(finalColor, 1.0);`);
	}

	lines.push("}");

	return lines.join("\n");
}
