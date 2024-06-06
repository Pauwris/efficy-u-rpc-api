import { CrmFetchErroreInterceptorFunction, CrmFetchRequestInterceptorFunction, CrmFetchResponseInterceptorFunction } from "./types.js";

// Base interceptor class with generic type for interceptor function
// eslint-disable-next-line @typescript-eslint/ban-types
abstract class CrmFetchInterceptor<T extends Function> {
	private funcs: T[] = [];

	// Abstract method to define specific interceptor behavior (request or response)
	protected abstract handle(data: any): Promise<void>;

	// Generic use method to add interceptors
	use(func: T): void {
		this.funcs.push(func);
	}

	// Generic clear method to remove all interceptors
	clear(): void {
		this.funcs.length = 0;
	}

	// Generic get interceptors method
	get interceptors(): ReadonlyArray<T> {
		return [...this.funcs]; // Create a copy to prevent mutation
	}

	// Internal method to chain interceptors for request or response handling
	protected async chain(data: any): Promise<void> {
		for (const func of this.funcs) {
			await func(data);
		}
	}
}

export class CrmFetchRequestInterceptor extends CrmFetchInterceptor<CrmFetchRequestInterceptorFunction> {
	async handle(request: Request): Promise<void> {
		await this.chain(request);
	}
}
export class CrmFetchResponseInterceptor extends CrmFetchInterceptor<CrmFetchResponseInterceptorFunction> {
	async handle(response: Response): Promise<void> {
		await this.chain(response);
	}
}
export class CrmFetchErrorInterceptor extends CrmFetchInterceptor<CrmFetchErroreInterceptorFunction> {
	async handle(e: Error): Promise<void> {
		await this.chain(e);
	}
}
