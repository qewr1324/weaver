// src/webview/shader/scripts/texture-store.ts
import { postToExtension } from "../../shared/vscode-api";

type TextureEntry = {
	key: string;
	path: string;
	image: HTMLImageElement;
	glTexture: WebGLTexture | null;
	glContext: WebGLRenderingContext | null;
	width: number;
	height: number;
	dirty: boolean;
};

const store = new Map<string, TextureEntry>();

export function getTexture(channelKey: string): TextureEntry | undefined {
	return store.get(channelKey);
}

export function getAllTextures(): TextureEntry[] {
	return [...store.values()];
}

export function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

export async function setTexture(channelKey: string, path: string): Promise<TextureEntry | null> {
	if (!path) return null;

	try {
		const img = await loadImageFromPath(path);

		const old = store.get(channelKey);
		if (old) {
			disposeEntry(old);
		}

		const entry: TextureEntry = {
			key: channelKey,
			path,
			image: img,
			glTexture: null,
			glContext: null,
			width: img.naturalWidth,
			height: img.naturalHeight,
			dirty: true,
		};
		store.set(channelKey, entry);

		const gl = getGL();
		if (gl) {
			uploadTextureToGPU(entry, gl);
		}

		return entry;
	} catch (err) {
		console.warn("[Weaver:texture] failed to load", channelKey, path, err);
		return null;
	}
}

export function clearTexture(channelKey: string): void {
	const entry = store.get(channelKey);
	if (entry) {
		disposeEntry(entry);
	}
	store.delete(channelKey);
}

function disposeEntry(entry: TextureEntry): void {
	if (entry.glTexture && entry.glContext) {
		try {
			entry.glContext.deleteTexture(entry.glTexture);
		} catch {
			/* ignore */
		}
	}
	entry.glTexture = null;
	entry.glContext = null;
}

function loadImageFromPath(path: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const requestId = `tex_${Date.now()}_${Math.random().toString(36).slice(2)}`;

		const handler = (e: MessageEvent) => {
			const msg = e.data;
			if (msg?.type !== "texture:loaded") return;
			if (msg.requestId !== requestId) return;

			window.removeEventListener("message", handler);

			if (!msg.ok || !msg.dataUrl) {
				reject(new Error(`Failed to load texture: ${path}`));
				return;
			}

			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error(`Failed to decode image: ${path}`));
			img.src = msg.dataUrl;
		};

		window.addEventListener("message", handler);
		postToExtension({ type: "texture:load", requestId, path });

		setTimeout(() => {
			window.removeEventListener("message", handler);
			reject(new Error(`Timeout loading texture: ${path}`));
		}, 8000);
	});
}

let glRef: WebGLRenderingContext | null = null;

export function registerGL(gl: WebGLRenderingContext): void {
	glRef = gl;
	for (const entry of store.values()) {
		if (entry.glContext && entry.glContext !== gl) {
			disposeEntry(entry);
			entry.dirty = true;
			uploadTextureToGPU(entry, gl);
		}
	}
}

function getGL(): WebGLRenderingContext | null {
	return glRef;
}

function uploadTextureToGPU(entry: TextureEntry, gl: WebGLRenderingContext): void {
	if (entry.glTexture && entry.glContext !== gl) {
		disposeEntry(entry);
	}

	if (entry.glTexture && !entry.dirty) return;

	if (entry.glTexture && entry.glContext === gl) {
		gl.deleteTexture(entry.glTexture);
	}

	const tex = gl.createTexture();
	if (!tex) return;

	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, entry.image);

	const isPOT = isPowerOfTwo(entry.width) && isPowerOfTwo(entry.height);
	if (isPOT) {
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	} else {
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	}
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	entry.glTexture = tex;
	entry.glContext = gl;
	entry.dirty = false;
}

export function uploadAllToGPU(): void {
	const gl = getGL();
	if (!gl) return;
	for (const entry of store.values()) {
		if (!entry.glTexture || entry.dirty || entry.glContext !== gl) {
			uploadTextureToGPU(entry, gl);
		}
	}
}

export function bindTexture(channelKey: string, unit: number): boolean {
	const gl = getGL();
	if (!gl) return false;

	const entry = store.get(channelKey);
	if (!entry) return false;

	if (!entry.glTexture || entry.glContext !== gl || entry.dirty) {
		uploadTextureToGPU(entry, gl);
	}

	if (!entry.glTexture || entry.glContext !== gl) return false;

	gl.activeTexture(gl.TEXTURE0 + unit);
	gl.bindTexture(gl.TEXTURE_2D, entry.glTexture);
	return true;
}

function isPowerOfTwo(n: number): boolean {
	return (n & (n - 1)) === 0;
}
