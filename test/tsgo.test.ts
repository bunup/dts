import { beforeEach, describe, expect, test } from 'bun:test'
import { cleanProjectDir, createProject, runGenerateDts } from './utils'

describe('tsgo option', () => {
	beforeEach(() => {
		cleanProjectDir()
	})

	test('should use tsgo (TypeScript native) compiler when enabled', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/index.ts': `
				export const computedValue = 1 + 2 + 3

				export function multiply(a: number, b: number) {
					return a * b
				}

				export const result = multiply(5, 10)
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
			tsgo: true,
		})

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "declare const computedValue: number;
		  declare function multiply(a: number, b: number): number;
		  declare const result: number;
		  export { result, multiply, computedValue };
		  "
		`)
	})

	test('should handle complex types with tsgo', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
					strict: true,
				},
			}),
			'src/types.ts': `
				export interface User {
					id: number
					name: string
					email: string
				}

				export type UserRole = 'admin' | 'user' | 'guest'

				export interface ApiResponse<T> {
					data: T
					status: number
					timestamp: number
				}
			`,
			'src/api.ts': `
				import type { User, UserRole, ApiResponse } from './types'

				export async function fetchUser(id: number): Promise<ApiResponse<User>> {
					return {
						data: { id, name: 'Test', email: 'test@example.com' },
						status: 200,
						timestamp: Date.now()
					}
				}

				export function hasRole(user: User, role: UserRole) {
					return true
				}

				export const defaultResponse = {
					status: 200,
					timestamp: Date.now()
				}
			`,
			'src/index.ts': `
				export * from './types'
				export * from './api'
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
			tsgo: true,
		})

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "interface User {
		  	id: number;
		  	name: string;
		  	email: string;
		  }
		  type UserRole = "admin" | "user" | "guest";
		  interface ApiResponse<T> {
		  	data: T;
		  	status: number;
		  	timestamp: number;
		  }
		  declare function fetchUser(id: number): Promise<ApiResponse<User>>;
		  declare function hasRole(user: User, role: UserRole): boolean;
		  declare const defaultResponse: {
		  	status: number;
		  	timestamp: number;
		  };
		  export { hasRole, fetchUser, defaultResponse, UserRole, User, ApiResponse };
		  "
		`)
	})

	test('should handle generics with tsgo', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/index.ts': `
				export function identity<T>(value: T) {
					return value
				}

				export class Box<T> {
					constructor(public value: T) {}

					map<U>(fn: (value: T) => U) {
						return new Box(fn(this.value))
					}
				}

				export const numberBox = new Box(42)
				export const stringBox = new Box('hello')
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
			tsgo: true,
		})

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "declare function identity<T>(value: T): T;
		  declare class Box<T> {
		  	value: T;
		  	constructor(value: T);
		  	map<U>(fn: (value: T) => U): Box<U>;
		  }
		  declare const numberBox: Box<number>;
		  declare const stringBox: Box<string>;
		  export { stringBox, numberBox, identity, Box };
		  "
		`)
	})

	test('should handle conditional types with tsgo', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/index.ts': `
				export type IsString<T> = T extends string ? true : false

				export type ExtractString<T> = T extends string ? T : never

				export type Flatten<T> = T extends Array<infer U> ? U : T

				export function flatten<T>(value: T): Flatten<T> {
					return Array.isArray(value) ? value[0] : value
				}

				export const result = flatten([1, 2, 3])
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
			tsgo: true,
		})

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "type IsString<T> = T extends string ? true : false;
		  type ExtractString<T> = T extends string ? T : never;
		  type Flatten<T> = T extends Array<infer U> ? U : T;
		  declare function flatten<T>(value: T): Flatten<T>;
		  declare const result: number;
		  export { result, flatten, IsString, Flatten, ExtractString };
		  "
		`)
	})

	test('should handle utility types with tsgo', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/index.ts': `
				interface User {
					id: number
					name: string
					email: string
					password: string
				}

				export type PublicUser = Omit<User, 'password'>

				export type PartialUser = Partial<User>

				export type RequiredUser = Required<PartialUser>

				export type ReadonlyUser = Readonly<User>

				export type UserKeys = keyof User

				export function createPublicUser(user: User): PublicUser {
					const { password, ...publicUser } = user
					return publicUser
				}
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
			tsgo: true,
		})

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "interface User {
		  	id: number;
		  	name: string;
		  	email: string;
		  	password: string;
		  }
		  type PublicUser = Omit<User, "password">;
		  type PartialUser = Partial<User>;
		  type RequiredUser = Required<PartialUser>;
		  type ReadonlyUser = Readonly<User>;
		  type UserKeys = keyof User;
		  declare function createPublicUser(user: User): PublicUser;
		  export { createPublicUser, UserKeys, RequiredUser, ReadonlyUser, PublicUser, PartialUser };
		  "
		`)
	})

	test('should handle async/await with tsgo', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
					lib: ['ESNext'],
				},
			}),
			'src/index.ts': `
				export async function fetchData(url: string) {
					const response = await fetch(url)
					return response.json()
				}

				export async function processData() {
					const data = await fetchData('https://api.example.com/data')
					return data
				}

				export const dataPromise = fetchData('https://api.example.com')
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
			tsgo: true,
		})

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "declare function fetchData(url: string): Promise<unknown>;
		  declare function processData(): Promise<unknown>;
		  declare const dataPromise: Promise<unknown>;
		  export { processData, fetchData, dataPromise };
		  "
		`)
	})

	test('should handle decorators with tsgo (experimentalDecorators)', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
					experimentalDecorators: true,
				},
			}),
			'src/index.ts': `
				export function logged(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
					const originalMethod = descriptor.value
					descriptor.value = function(...args: any[]) {
						console.log(\`Calling \${propertyKey}\`)
						return originalMethod.apply(this, args)
					}
					return descriptor
				}

				export class Calculator {
					@logged
					add(a: number, b: number) {
						return a + b
					}
				}
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
			tsgo: true,
		})

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "declare function logged(target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor;
		  declare class Calculator {
		  	add(a: number, b: number): number;
		  }
		  export { logged, Calculator };
		  "
		`)
	})

	test('should work with both tsgo and inferTypes for complex scenarios', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
					strict: true,
				},
			}),
			'src/utils/math.ts': `
				export function add(a: number, b: number) {
					return a + b
				}

				export const PI = Math.PI
				export const E = Math.E
			`,
			'src/utils/string.ts': `
				export function capitalize(str: string) {
					return str.charAt(0).toUpperCase() + str.slice(1)
				}

				export const EMPTY_STRING = ''
			`,
			'src/utils/index.ts': `
				export * from './math'
				export * from './string'
			`,
			'src/services/calculator.ts': `
				import { add, PI } from '../utils/math'

				export class Calculator {
					add(a: number, b: number) {
						return add(a, b)
					}

					circleArea(radius: number) {
						return PI * radius * radius
					}
				}

				export const calc = new Calculator()
				export const result = calc.add(5, 10)
			`,
			'src/index.ts': `
				export * from './utils'
				export * from './services/calculator'
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
			tsgo: true,
		})

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "declare function add(a: number, b: number): number;
		  declare const PI: number;
		  declare const E: number;
		  declare function capitalize(str: string): string;
		  declare const EMPTY_STRING = "";
		  declare class Calculator {
		  	add(a: number, b: number): number;
		  	circleArea(radius: number): number;
		  }
		  declare const calc: Calculator;
		  declare const result: number;
		  export { result, capitalize, calc, add, PI, EMPTY_STRING, E, Calculator };
		  "
		`)
	})

	test('should handle enum declarations with tsgo', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/index.ts': `
				export enum Status {
					Active,
					Inactive,
					Pending
				}

				export enum HttpStatus {
					OK = 200,
					NotFound = 404,
					ServerError = 500
				}

				export function getStatusMessage(status: Status) {
					return status === Status.Active ? 'Active' : 'Not Active'
				}

				export const currentStatus = Status.Active
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
			tsgo: true,
		})

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "declare enum Status {
		  	Active = 0,
		  	Inactive = 1,
		  	Pending = 2
		  }
		  declare enum HttpStatus {
		  	OK = 200,
		  	NotFound = 404,
		  	ServerError = 500
		  }
		  declare function getStatusMessage(status: Status): "Active" | "Not Active";
		  declare const currentStatus: unknown;
		  export { getStatusMessage, currentStatus, Status, HttpStatus };
		  "
		`)
	})

	test('should handle deeply nested file structure with tsgo', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/domain/entities/user.ts': `
				export interface User {
					id: number
					email: string
				}
			`,
			'src/domain/entities/post.ts': `
				import type { User } from './user'

				export interface Post {
					id: number
					title: string
					author: User
				}
			`,
			'src/domain/entities/index.ts': `
				export * from './user'
				export * from './post'
			`,
			'src/domain/services/user-service.ts': `
				import type { User } from '../entities/user'

				export function createUser(email: string) {
					return {
						id: Math.random(),
						email
					} as User
				}

				export const defaultUser = createUser('default@example.com')
			`,
			'src/domain/services/post-service.ts': `
				import type { Post } from '../entities/post'
				import { createUser } from './user-service'

				export function createPost(title: string) {
					return {
						id: Math.random(),
						title,
						author: createUser('author@example.com')
					} as Post
				}

				export const samplePost = createPost('Sample Title')
			`,
			'src/domain/services/index.ts': `
				export * from './user-service'
				export * from './post-service'
			`,
			'src/domain/index.ts': `
				export * from './entities'
				export * from './services'
			`,
			'src/api/controllers/user-controller.ts': `
				import { createUser, defaultUser } from '../../domain/services/user-service'

				export function handleCreateUser(email: string) {
					return createUser(email)
				}

				export const controllerDefault = defaultUser
			`,
			'src/api/controllers/index.ts': `
				export * from './user-controller'
			`,
			'src/api/index.ts': `
				export * from './controllers'
			`,
			'src/index.ts': `
				export * from './domain'
				export * from './api'
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
			tsgo: true,
		})

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "interface User2 {
		  	id: number;
		  	email: string;
		  }
		  interface Post {
		  	id: number;
		  	title: string;
		  	author: User2;
		  }
		  declare function createUser(email: string): User2;
		  declare const defaultUser: User2;
		  declare function createPost(title: string): Post;
		  declare const samplePost: Post;
		  declare function handleCreateUser(email: string): import("../..").User;
		  declare const controllerDefault: import("../..").User;
		  export { samplePost, handleCreateUser, defaultUser, createUser, createPost, controllerDefault, User2 as User, Post };
		  "
		`)
	})

	test('should handle very deep imports (7+ levels) with tsgo', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/l1/l2/l3/l4/l5/l6/l7/deepest.ts': `
				export function deepestFunction(n: number) {
					return n ** 2
				}

				export const DEEPEST_VALUE = 999
			`,
			'src/l1/l2/l3/l4/l5/l6/level6.ts': `
				import { deepestFunction, DEEPEST_VALUE } from './l7/deepest'

				export function level6Function(x: number) {
					return deepestFunction(x) + DEEPEST_VALUE
				}
			`,
			'src/l1/l2/l3/l4/l5/level5.ts': `
				import { level6Function } from './l6/level6'

				export function level5Function(x: number) {
					return level6Function(x) * 2
				}
			`,
			'src/l1/l2/l3/l4/level4.ts': `
				import { level5Function } from './l5/level5'

				export function level4Function(x: number) {
					return level5Function(x) + 100
				}
			`,
			'src/l1/l2/l3/level3.ts': `
				import { level4Function } from './l4/level4'

				export const computed3 = level4Function(5)
			`,
			'src/l1/l2/level2.ts': `
				import { computed3 } from './l3/level3'

				export const computed2 = computed3 * 2
			`,
			'src/l1/level1.ts': `
				import { computed2 } from './l2/level2'

				export const computed1 = computed2 + 50
			`,
			'src/index.ts': `
				import { computed1 } from './l1/level1'

				export const finalComputed = computed1 * 3

				export function getFinalValue() {
					return finalComputed
				}
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
			tsgo: true,
		})

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "declare const finalComputed: number;
		  declare function getFinalValue(): number;
		  export { getFinalValue, finalComputed };
		  "
		`)
	})

	test('should handle functions without return types with tsgo', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/lib/math.ts': `
				export function factorial(n: number) {
					if (n <= 1) return 1
					return n * factorial(n - 1)
				}

				export function fibonacci(n: number) {
					if (n <= 1) return n
					return fibonacci(n - 1) + fibonacci(n - 2)
				}

				export function power(base: number, exp: number) {
					return Math.pow(base, exp)
				}
			`,
			'src/lib/string.ts': `
				export function reverse(str: string) {
					return str.split('').reverse().join('')
				}

				export function titleCase(str: string) {
					return str.split(' ').map(word =>
						word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
					).join(' ')
				}

				export function wordCount(str: string) {
					return str.split(' ').filter(word => word.length > 0).length
				}
			`,
			'src/lib/array.ts': `
				export function chunk<T>(arr: T[], size: number) {
					const chunks = []
					for (let i = 0; i < arr.length; i += size) {
						chunks.push(arr.slice(i, i + size))
					}
					return chunks
				}

				export function unique<T>(arr: T[]) {
					return [...new Set(arr)]
				}

				export function flatten<T>(arr: T[][]) {
					return arr.reduce((acc, val) => acc.concat(val), [])
				}
			`,
			'src/index.ts': `
				import { factorial, power } from './lib/math'
				import { reverse, titleCase } from './lib/string'
				import { chunk, unique } from './lib/array'

				export function processNumber(n: number) {
					return factorial(n) + power(n, 2)
				}

				export function processString(str: string) {
					return {
						reversed: reverse(str),
						titled: titleCase(str)
					}
				}

				export function processArray(arr: number[]) {
					return {
						chunks: chunk(arr, 2),
						unique: unique(arr)
					}
				}

				export const numResult = processNumber(5)
				export const strResult = processString('hello world')
				export const arrResult = processArray([1, 2, 2, 3, 3, 4])
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
			tsgo: true,
		})

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "declare function processNumber(n: number): any;
		  declare function processString(str: string): {
		  	reversed: string;
		  	titled: string;
		  };
		  declare function processArray(arr: number[]): {
		  	chunks: any[];
		  	unique: number[];
		  };
		  declare const numResult: any;
		  declare const strResult: {
		  	reversed: string;
		  	titled: string;
		  };
		  declare const arrResult: {
		  	chunks: any[];
		  	unique: number[];
		  };
		  export { strResult, processString, processNumber, processArray, numResult, arrResult };
		  "
		`)
	})

	test('should handle variables without explicit types with tsgo', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/constants/app.ts': `
				export const APP_NAME = 'MyApp'
				export const APP_VERSION = '2.0.0'
				export const MAX_RETRIES = 5
				export const TIMEOUT_MS = 30000
			`,
			'src/constants/urls.ts': `
				export const BASE_URL = 'https://api.example.com'
				export const API_VERSION = 'v1'
				export const FULL_API_URL = \`\${BASE_URL}/\${API_VERSION}\`
			`,
			'src/config/settings.ts': `
				import { APP_NAME, APP_VERSION, MAX_RETRIES } from '../constants/app'
				import { FULL_API_URL } from '../constants/urls'

				export const settings = {
					app: {
						name: APP_NAME,
						version: APP_VERSION
					},
					network: {
						apiUrl: FULL_API_URL,
						retries: MAX_RETRIES
					},
					features: {
						caching: true,
						analytics: true
					}
				}

				export const appName = settings.app.name
				export const networkConfig = settings.network
			`,
			'src/utils/helpers.ts': `
				import { settings } from '../config/settings'

				export const createUrl = (path: string) => {
					return settings.network.apiUrl + path
				}

				export const usersUrl = createUrl('/users')
				export const postsUrl = createUrl('/posts')

				export const metadata = {
					version: settings.app.version,
					endpoints: {
						users: usersUrl,
						posts: postsUrl
					}
				}
			`,
			'src/index.ts': `
				import { settings, appName, networkConfig } from './config/settings'
				import { usersUrl, postsUrl, metadata } from './utils/helpers'
				import { APP_NAME, APP_VERSION } from './constants/app'

				export const config = settings
				export const name = appName
				export const network = networkConfig
				export const urls = { users: usersUrl, posts: postsUrl }
				export const meta = metadata

				export const fullConfig = {
					...settings,
					urls: urls,
					meta: meta
				}

				export const constants = {
					name: APP_NAME,
					version: APP_VERSION
				}
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
			tsgo: true,
		})

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "declare const config: {
		  	app: {
		  		name: string;
		  		version: string;
		  	};
		  	network: {
		  		apiUrl: string;
		  		retries: number;
		  	};
		  	features: {
		  		caching: boolean;
		  		analytics: boolean;
		  	};
		  };
		  declare const name: string;
		  declare const network: {
		  	apiUrl: string;
		  	retries: number;
		  };
		  declare const urls: {
		  	users: string;
		  	posts: string;
		  };
		  declare const meta: {
		  	version: string;
		  	endpoints: {
		  		users: string;
		  		posts: string;
		  	};
		  };
		  declare const fullConfig: {
		  	app: {
		  		name: string;
		  		version: string;
		  	};
		  	network: {
		  		apiUrl: string;
		  		retries: number;
		  	};
		  	features: {
		  		caching: boolean;
		  		analytics: boolean;
		  	};
		  	urls: {
		  		users: string;
		  		posts: string;
		  	};
		  	meta: {
		  		version: string;
		  		endpoints: {
		  			users: string;
		  			posts: string;
		  		};
		  	};
		  };
		  declare const constants: {
		  	name: string;
		  	version: string;
		  };
		  export { urls, network, name, meta, fullConfig, constants, config };
		  "
		`)
	})

	test('should handle cross-module imports with tsgo', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/featureA/utils.ts': `
				export function utilA(x: number) {
					return x * 2
				}

				export const VALUE_A = 100
			`,
			'src/featureB/utils.ts': `
				import { utilA, VALUE_A } from '../featureA/utils'

				export function utilB(x: number) {
					return utilA(x) + VALUE_A
				}

				export const VALUE_B = utilB(50)
			`,
			'src/featureC/utils.ts': `
				import { utilB, VALUE_B } from '../featureB/utils'
				import { utilA, VALUE_A } from '../featureA/utils'

				export function utilC(x: number) {
					return utilA(x) + utilB(x) + VALUE_B
				}

				export const VALUE_C = utilC(10) + VALUE_A
			`,
			'src/featureD/utils.ts': `
				import { utilC, VALUE_C } from '../featureC/utils'
				import { utilB, VALUE_B } from '../featureB/utils'

				export function utilD(x: number) {
					return utilB(x) + utilC(x)
				}

				export const VALUE_D = VALUE_B + VALUE_C
				export const RESULT_D = utilD(20)
			`,
			'src/index.ts': `
				import { utilD, VALUE_D, RESULT_D } from './featureD/utils'
				import { utilC, VALUE_C } from './featureC/utils'

				export function combined(x: number) {
					return utilC(x) + utilD(x)
				}

				export const finalValue = VALUE_C + VALUE_D
				export const finalResult = combined(15) + RESULT_D
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
			tsgo: true,
		})

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "declare function combined(x: number): number;
		  declare const finalValue: number;
		  declare const finalResult: number;
		  export { finalValue, finalResult, combined };
		  "
		`)
	})

	test('should handle complex nested structure with mixed types using tsgo', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/x/y/z/base.ts': `
				export interface BaseConfig {
					enabled: boolean
				}

				export function createBase(enabled: boolean) {
					return { enabled }
				}

				export const defaultBase = createBase(true)
			`,
			'src/x/y/extended.ts': `
				import { createBase, defaultBase } from './z/base'

				export function extendConfig(name: string) {
					return {
						...createBase(true),
						name
					}
				}

				export const extendedDefault = extendConfig('default')
				export const baseValue = defaultBase.enabled
			`,
			'src/x/top.ts': `
				import { extendConfig, extendedDefault } from './y/extended'

				export const topConfig = {
					...extendedDefault,
					version: '1.0'
				}

				export function createTopConfig(name: string, version: string) {
					return {
						...extendConfig(name),
						version
					}
				}

				export const myConfig = createTopConfig('myapp', '2.0')
			`,
			'src/a/b/processor.ts': `
				import { topConfig, createTopConfig } from '../../x/top'

				export function processConfig() {
					return {
						processed: true,
						config: topConfig
					}
				}

				export const processed = processConfig()
				export const customConfig = createTopConfig('custom', '3.0')
			`,
			'src/index.ts': `
				import { processed, customConfig } from './a/b/processor'
				import { topConfig } from './x/top'

				export const main = {
					top: topConfig,
					processed: processed,
					custom: customConfig
				}

				export function getMainConfig() {
					return main
				}

				export const mainConfig = getMainConfig()
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
			tsgo: true,
		})

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "declare const main: {
		  	top: {
		  		enabled: boolean;
		  		name: string;
		  		version: string;
		  	};
		  	processed: {
		  		processed: boolean;
		  		config: {
		  			enabled: boolean;
		  			name: string;
		  			version: string;
		  		};
		  	};
		  	custom: {
		  		enabled: boolean;
		  		name: string;
		  		version: string;
		  	};
		  };
		  declare function getMainConfig(): {
		  	top: {
		  		enabled: boolean;
		  		name: string;
		  		version: string;
		  	};
		  	processed: {
		  		processed: boolean;
		  		config: {
		  			enabled: boolean;
		  			name: string;
		  			version: string;
		  		};
		  	};
		  	custom: {
		  		enabled: boolean;
		  		name: string;
		  		version: string;
		  	};
		  };
		  declare const mainConfig: {
		  	top: {
		  		enabled: boolean;
		  		name: string;
		  		version: string;
		  	};
		  	processed: {
		  		processed: boolean;
		  		config: {
		  			enabled: boolean;
		  			name: string;
		  			version: string;
		  		};
		  	};
		  	custom: {
		  		enabled: boolean;
		  		name: string;
		  		version: string;
		  	};
		  };
		  export { mainConfig, main, getMainConfig };
		  "
		`)
	})
})
