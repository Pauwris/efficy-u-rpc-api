import { CrmFetchErroreInterceptorFunction, CrmFetchRequestInterceptorFunction, CrmFetchResponseInterceptorFunction, ModulePostPayload } from "./types.js";

// Base interceptor class with generic type for interceptor function
// eslint-disable-next-line @typescript-eslint/ban-types
abstract class CrmFetchInterceptor<T extends Function> {
	private funcs: T[] = [];

	// Abstract method to define specific interceptor behavior (request or response)
	protected abstract handle(...args: any[]): Promise<void>;

	/**
	 * Generic use method to add interceptors
	 * @example
	 * crmEnv.interceptors.onRequest.use(async(request: Request) => {
	 *   onRequestUrlOrigin = new URL(request.url).origin;
	 * })
	 * crmEnv.interceptors.onPositiveResponse.use(async(response: Response) => {
	 *   onResponseCustomHeader = response.headers.get("x-efficy-status") ?? "";
	 * })
	 * crmEnv.interceptors.onError.use(async(e: Error, request: Request, requestPayload: ModulePostPayload | undefined, response: Response | null) => {
	 *   if (requestPayload && typeof requestPayload === "object") requestObject = requestPayload;
	 * })
	 */
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
	protected async chain(...args: any[]): Promise<void> {
		for (const func of this.funcs) {
			await func(...args);
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
	async handle(e: Error, request: Request, requestPayload: ModulePostPayload | undefined, response: Response | null): Promise<void> {
		await this.chain(e, request, requestPayload, response);
	}
}
