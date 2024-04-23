import { JSONPrimitiveObject } from "src/types/public.js";

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

export class FetchQueue {
	#id = 0;
	#startTime = 0;

	static debug = false;
	static forceSequential = false;
	static waitTime = 10; // milliseconds
	static pending = false;
	static fetchCount = 0;
	static totalRequestTime = 0;
	static minRequestTime = Infinity;
	static maxRequestTime = 0;

	constructor() {
		FetchQueue.fetchCount++;
		this.#id = FetchQueue.fetchCount;
	}

	pleaseWait() {
		return (FetchQueue.pending === true)
	}
	takeTurn() {
		FetchQueue.pending = true;
		this.#startTime = Date.now();
		FetchQueue.debug && console.log(`takeTurn: ${this.#id}/${FetchQueue.fetchCount}`)
	}
	finished() {
		const requestTime = Date.now() - this.#startTime;
		FetchQueue.totalRequestTime += requestTime;
		FetchQueue.minRequestTime = Math.min(FetchQueue.minRequestTime, requestTime);
		FetchQueue.maxRequestTime = Math.max(FetchQueue.maxRequestTime, requestTime);

		FetchQueue.pending = false;
		FetchQueue.debug && console.log(`finished: ${this.#id}/${FetchQueue.fetchCount}`)
	}

	async sleep() {
		await new Promise(r => setTimeout(r, FetchQueue.waitTime));
	}
	async waitMyTurn() {
		if (FetchQueue.forceSequential) {
			while (this.pleaseWait()) {
				await this.sleep();
			}
		}

		this.takeTurn();
	}

	static get averageRequestTime() {
		return FetchQueue.totalRequestTime / FetchQueue.fetchCount;
	}

	static get stats() {
		return {
			"fetchCount": FetchQueue.fetchCount,
			"averageRequestTime": FetchQueue.averageRequestTime,
			"totalRequestTime": FetchQueue.totalRequestTime,
			"maxRequestTime": FetchQueue.maxRequestTime,
			"minRequestTime": FetchQueue.minRequestTime
		}
	}
}

export function uuidv4() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}