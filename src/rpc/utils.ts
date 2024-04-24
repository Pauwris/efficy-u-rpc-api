import { JSONPrimitiveObject } from "src/types.js";

/**
 * Find and return the first (deep) nested object where all properties of the provided searchObject match.
 * Inspired by https://pretagteam.com/question/finding-an-object-deep-in-a-nested-json-object
 */
export function findDeep(object: any, searchObject: any): JSONPrimitiveObject | undefined {
	if (typeof searchObject !== 'object' || searchObject === null) {
		throw new TypeError('findDeep::searchObject must be a non-null object');
	}

	const isEqual = (obj: any): boolean => {
		for (const key in searchObject) {
			if (!Object.prototype.hasOwnProperty.call(obj, key) || obj[key] !== searchObject[key]) {
				return false;
			}
		}
		return true;
	};

	if (Array.isArray(object)) {
		for (const item of object) {
			const result = findDeep(item, searchObject);
			if (result) return result;
		}
	} else if (typeof object === 'object' && object !== null) {
		if (isEqual(object)) {
			return object;
		}
		for (const key of Object.keys(object)) {
			const nestedObject = findDeep(object[key], searchObject);
			if (nestedObject) return nestedObject;
		}
	}
}

export function uuidv4() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}