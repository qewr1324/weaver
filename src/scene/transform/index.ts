export interface Vector3Like {
	x: number;
	y: number;
	z: number;
}

export interface QuaternionLike {
	x: number;
	y: number;
	z: number;
	w: number;
}

export interface TransformData {
	position: Vector3Like;
	rotation: QuaternionLike;
	scale: Vector3Like;
}

export const vec3 = (x = 0, y = 0, z = 0): Vector3Like => ({ x, y, z });
export const quat = (x = 0, y = 0, z = 0, w = 1): QuaternionLike => ({ x, y, z, w });

export class Transform {
	position: Vector3Like = vec3();
	rotation: QuaternionLike = quat();
	scale: Vector3Like = vec3(1, 1, 1);

	toJSON(): TransformData {
		return {
			position: { ...this.position },
			rotation: { ...this.rotation },
			scale: { ...this.scale },
		};
	}

	static fromJSON(data: TransformData): Transform {
		const t = new Transform();
		t.position = { ...data.position };
		t.rotation = { ...data.rotation };
		t.scale = { ...data.scale };
		return t;
	}
}
