// src/webview/shader/scripts/texture-store.ts
// ✨ Texture store — آپلود، cache، bind کردن texture ها برای preview

type TextureEntry = {
	key: string; // مثل "baseColor"
	image: HTMLImageElement;
	glTexture: WebGLTexture | null;
	dataUrl: string;
	width: number;
	height: number;
};

const store = new Map<string, TextureEntry>();

/**
 * آپلود یه فایل texture و برگرداندن dataUrl.
 */
export function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

/**
 * لود یه image از dataUrl یا path.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
		img.src = src;
	});
}

/**
 * ذخیره texture برای یه channel.
 */
export async function setTexture(channelKey: string, src: string): Promise<TextureEntry | null> {
	try {
		const img = await loadImage(src);
		const entry: TextureEntry = {
			key: channelKey,
			image: img,
			glTexture: null,
			dataUrl: src,
			width: img.naturalWidth,
			height: img.naturalHeight,
		};
		store.set(channelKey, entry);
		return entry;
	} catch (err) {
		console.warn("[Weaver:shader:texture] failed to load", channelKey, err);
		return null;
	}
}

/**
 * حذف texture.
 */
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

/**
 * آپلود همه texture ها به GPU.
 */
export function uploadAllToGPU(): void {
	const gl = getGL();
	if (!gl) return;

	for (const entry of store.values()) {
		if (entry.glTexture) continue;

		const tex = gl.createTexture();
		if (!tex) continue;

		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, entry.image);

		// ✅ power-of-2 check
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

/**
 * بایند یه texture برای یه unit.
 */
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
