// src/webview/shader/scripts/preview/geometry.ts
// ✨ هندسه‌های آماده برای preview

export interface MeshData {
	positions: Float32Array;
	normals: Float32Array;
	uvs: Float32Array;
	indices: Uint16Array;
}

export function createSphere(radius = 1, segments = 48, rings = 48): MeshData {
	const positions: number[] = [];
	const normals: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];

	for (let y = 0; y <= rings; y++) {
		const v = y / rings;
		const phi = v * Math.PI;

		for (let x = 0; x <= segments; x++) {
			const u = x / segments;
			const theta = u * Math.PI * 2;

			const nx = Math.sin(phi) * Math.cos(theta);
			const ny = Math.cos(phi);
			const nz = Math.sin(phi) * Math.sin(theta);

			positions.push(nx * radius, ny * radius, nz * radius);
			normals.push(nx, ny, nz);
			uvs.push(u, v);
		}
	}

	for (let y = 0; y < rings; y++) {
		for (let x = 0; x < segments; x++) {
			const a = y * (segments + 1) + x;
			const b = a + 1;
			const c = a + (segments + 1);
			const d = c + 1;

			indices.push(a, c, b);
			indices.push(b, c, d);
		}
	}

	return {
		positions: new Float32Array(positions),
		normals: new Float32Array(normals),
		uvs: new Float32Array(uvs),
		indices: new Uint16Array(indices),
	};
}

export function createPlane(size = 2): MeshData {
	const h = size / 2;
	return {
		positions: new Float32Array([-h, -h, 0, h, -h, 0, h, h, 0, -h, h, 0]),
		normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
		uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
		indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
	};
}

export function createBox(size = 1.2): MeshData {
	const h = size / 2;
	const positions: number[] = [];
	const normals: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];

	const faces: Array<{
		normal: [number, number, number];
		corners: Array<[number, number, number]>;
	}> = [
		{
			normal: [0, 0, 1],
			corners: [
				[-h, -h, h],
				[h, -h, h],
				[h, h, h],
				[-h, h, h],
			],
		},
		{
			normal: [0, 0, -1],
			corners: [
				[h, -h, -h],
				[-h, -h, -h],
				[-h, h, -h],
				[h, h, -h],
			],
		},
		{
			normal: [1, 0, 0],
			corners: [
				[h, -h, h],
				[h, -h, -h],
				[h, h, -h],
				[h, h, h],
			],
		},
		{
			normal: [-1, 0, 0],
			corners: [
				[-h, -h, -h],
				[-h, -h, h],
				[-h, h, h],
				[-h, h, -h],
			],
		},
		{
			normal: [0, 1, 0],
			corners: [
				[-h, h, h],
				[h, h, h],
				[h, h, -h],
				[-h, h, -h],
			],
		},
		{
			normal: [0, -1, 0],
			corners: [
				[-h, -h, -h],
				[h, -h, -h],
				[h, -h, h],
				[-h, -h, h],
			],
		},
	];

	for (const face of faces) {
		const base = positions.length / 3;
		for (const c of face.corners) {
			positions.push(c[0], c[1], c[2]);
			normals.push(face.normal[0], face.normal[1], face.normal[2]);
		}
		uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
		indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
	}

	return {
		positions: new Float32Array(positions),
		normals: new Float32Array(normals),
		uvs: new Float32Array(uvs),
		indices: new Uint16Array(indices),
	};
}
