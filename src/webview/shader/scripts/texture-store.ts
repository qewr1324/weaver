// src/webview/shader/scripts/texture-store.ts
import { postToExtension } from "../../shared/vscode-api";

type TextureEntry = {
	key: string;
	image: HTMLImageElement;
	glTexture: WebGLTexture | null;
	dataUrl: string;
	width: number;
	height: number;
	sourcePath: string;
};

const store = new Map<string, TextureEntry>();

export function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

/**
 * ✅ loadImage — از extension برای path های نسبی درخواست می‌کنه
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`Failed to load image: ${src}`));

		// ✅ dataURL یا http یا vscode- → مستقیم
		if (src.startsWith("data:") || src.startsWith("http") || src.startsWith("vscode-") || src.startsWith("blob:")) {
			img.src = src;
			return;
		}

		// ✅ path نسبی → از extension بخواه
		const requestId = `tex_${Date.now()}_${Math.random().toString(36).slice(2)}`;

		const handler = (e: MessageEvent) => {
			const msg = e.data;
			if (msg?.type !== "texture:loaded") return;
			if (msg.requestId !== requestId) return;

			window.removeEventListener("message", handler);

			if (msg.ok && msg.dataUrl) {
				img.src = msg.dataUrl;
			} else {
				reject(new Error(`Failed to load texture from path: ${src}`));
			}
		};

		window.addEventListener("message", handler);

		postToExtension({
			type: "texture:load",
			requestId,
			path: src,
		});

		setTimeout(() => {
			window.removeEventListener("message", handler);
			reject(new Error(`Timeout loading texture: ${src}`));
		}, 5000);
	});
}

export async function setTexture(channelKey: string, src: string): Promise<TextureEntry | null> {
	try {
		const img = await loadImage(src);
		const entry: TextureEntry = {
			key: channelKey,
			image: img,
			glTexture: null,
			dataUrl: img.src,
			width: img.naturalWidth,
			height: img.naturalHeight,
			sourcePath: src,
		};
		store.set(channelKey, entry);
		return entry;
	} catch (err) {
		console.warn("[Weaver:shader:texture] failed to load", channelKey, err);
		return null;
	}
}

export function clearTexture(channelKey: string): void {
	const entry = store.get(channelKey);
	if (entry?.glTexture) {
		const gl = getGL();
		gl?.deleteTexture(entry.glTexture);
	}
	store.delete(channelKey);
}

export function getTexture(channelKey: string): TextureEntry | undefined {
	return store.get(channelKey);
}

export function getAllTextures(): TextureEntry[] {
	return [...store.values()];
}

// ─── WebGL integration ───
let glRef: WebGLRenderingContext | null = null;

export function registerGL(gl: WebGLRenderingContext): void {
	glRef = gl;
}

function getGL(): WebGLRenderingContext | null {
	return glRef;
}

export function uploadAllToGPU(): void {
	const gl = getGL();
	if (!gl) return;

	for (const entry of store.values()) {
		if (entry.glTexture) continue;

		const tex = gl.createTexture();
		if (!tex) continue;

		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, entry.image);

		const isPOT = isPowerOfTwo(entry.width) && isPowerOfTwo(entry.height);
		if (isPOT) {
			gl.generateMipmap(gl.TEXTURE_2D);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		} else {
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		}

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

		entry.glTexture = tex;
	}
}

export function bindTexture(channelKey: string, unit: number): boolean {
	const gl = getGL();
	if (!gl) return false;

	const entry = store.get(channelKey);
	if (!entry?.glTexture) return false;

	gl.activeTexture(gl.TEXTURE0 + unit);
	gl.bindTexture(gl.TEXTURE_2D, entry.glTexture);
	return true;
}

function isPowerOfTwo(n: number): boolean {
	return (n & (n - 1)) === 0;
}
