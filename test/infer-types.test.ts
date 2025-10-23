import { beforeEach, describe, expect, test } from 'bun:test'
import { cleanProjectDir, createProject, runGenerateDts } from './utils'

describe('inferTypes option', () => {
	beforeEach(() => {
		cleanProjectDir()
	})

	test('should infer types for expressions without explicit types', async () => {
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

				export const stringArray = ['hello', 'world']

				export const mixedData = {
					count: 42,
					name: 'test',
					nested: {
						value: true
					}
				}
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
		})

		expect(files[0].dts).toContain('declare const computedValue: number')
		expect(files[0].dts).toContain('declare function multiply')
		expect(files[0].dts).toContain('declare const result: number')
		expect(files[0].dts).toContain('declare const stringArray: string[]')
		expect(files[0].dts).toContain('declare const mixedData')
	})

	test('should handle complex type inference with generics', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/utils.ts': `
				export function identity<T>(value: T) {
					return value
				}

				export function mapArray<T, U>(arr: T[], fn: (item: T) => U) {
					return arr.map(fn)
				}
			`,
			'src/index.ts': `
				import { identity, mapArray } from './utils'

				export const numberResult = identity(42)
				export const stringResult = identity('hello')

				export const numbers = [1, 2, 3]
				export const doubled = mapArray(numbers, x => x * 2)
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
		})

		expect(files[0].dts).toContain('declare const numberResult')
		expect(files[0].dts).toContain('declare const stringResult')
		expect(files[0].dts).toContain('declare const numbers')
		expect(files[0].dts).toContain('declare const doubled')
	})

	test('should infer return types for functions without explicit return type', async () => {
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
				export function add(a: number, b: number) {
					return a + b
				}

				export function createUser(name: string, age: number) {
					return {
						name,
						age,
						isActive: true
					}
				}

				export async function fetchData() {
					return { data: 'test', timestamp: Date.now() }
				}
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
		})

		expect(files[0].dts).toContain(
			'declare function add(a: number, b: number): number',
		)
		expect(files[0].dts).toContain('declare function createUser')
		expect(files[0].dts).toContain('declare function fetchData()')
	})

	test('should handle nested file imports with type inference', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/constants.ts': `
				export const API_URL = 'https://api.example.com'
				export const TIMEOUT = 5000
				export const CONFIG = {
					retries: 3,
					cache: true
				}
			`,
			'src/api.ts': `
				import { API_URL, TIMEOUT, CONFIG } from './constants'

				export function buildUrl(path: string) {
					return API_URL + path
				}

				export const maxTimeout = TIMEOUT * 2

				export const apiConfig = {
					...CONFIG,
					url: API_URL
				}
			`,
			'src/index.ts': `
				export { buildUrl, maxTimeout, apiConfig } from './api'
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
		})

		expect(files[0].dts).toContain('declare function buildUrl')
		expect(files[0].dts).toContain('declare const maxTimeout')
		expect(files[0].dts).toContain('declare const apiConfig')
	})

	test('should handle class property type inference', async () => {
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
				export class Calculator {
					value = 0

					add(n: number) {
						this.value += n
						return this
					}

					multiply(n: number) {
						this.value *= n
						return this
					}

					getResult() {
						return this.value
					}
				}

				export const calc = new Calculator()
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
		})

		expect(files[0].dts).toContain('declare class Calculator')
		expect(files[0].dts).toContain('value: number')
		expect(files[0].dts).toContain('add(n: number): this')
		expect(files[0].dts).toContain('multiply(n: number): this')
		expect(files[0].dts).toContain('getResult(): number')
	})

	test('should work with path aliases defined in tsconfig', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
					baseUrl: '.',
					paths: {
						'@/*': ['src/*'],
					},
				},
			}),
			'src/types/user.ts': `
				export interface User {
					id: number
					name: string
				}
			`,
			'src/services/user-service.ts': `
				import type { User } from '@/types/user'

				export function getUser(id: number): User {
					return { id, name: 'Test' }
				}

				export const defaultUser = getUser(1)
			`,
			'src/index.ts': `
				export { getUser, defaultUser } from './services/user-service'
				export type { User } from './types/user'
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
		})

		expect(files[0].dts).toContain('interface User')
		expect(files[0].dts).toContain('declare function getUser')
		expect(files[0].dts).toContain('declare const defaultUser')
	})

	test('should error when inferTypes is enabled but no tsconfig exists', async () => {
		createProject({
			'src/index.ts': `
				export const value = 42
			`,
		})

		expect(
			runGenerateDts(['src/index.ts'], {
				inferTypes: true,
			}),
		).rejects.toThrow('The "inferTypes" option requires a tsconfig.json file')
	})

	test('should handle array methods with type inference', async () => {
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
				const numbers = [1, 2, 3, 4, 5]

				export const doubled = numbers.map(n => n * 2)
				export const filtered = numbers.filter(n => n > 2)
				export const sum = numbers.reduce((acc, n) => acc + n, 0)

				const users = [
					{ name: 'Alice', age: 30 },
					{ name: 'Bob', age: 25 }
				]

				export const names = users.map(u => u.name)
				export const adults = users.filter(u => u.age >= 18)
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
		})

		expect(files[0].dts).toContain('declare const doubled: number[]')
		expect(files[0].dts).toContain('declare const filtered: number[]')
		expect(files[0].dts).toContain('declare const sum: number')
		expect(files[0].dts).toContain('declare const names: string[]')
		expect(files[0].dts).toContain('declare const adults')
	})

	test('should handle deeply nested file structure with inferTypes', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/core/types/user.ts': `
				export interface User {
					id: number
					name: string
				}
			`,
			'src/core/types/index.ts': `
				export * from './user'
			`,
			'src/core/utils/validators.ts': `
				export function validateEmail(email: string) {
					return email.includes('@')
				}

				export const MIN_PASSWORD_LENGTH = 8
			`,
			'src/core/utils/index.ts': `
				export * from './validators'
			`,
			'src/core/index.ts': `
				export * from './types'
				export * from './utils'
			`,
			'src/services/auth/login.ts': `
				import type { User } from '../../core/types/user'
				import { validateEmail } from '../../core/utils/validators'

				export function login(email: string, password: string) {
					if (!validateEmail(email)) {
						throw new Error('Invalid email')
					}
					return {
						user: { id: 1, name: 'Test' } as User,
						token: 'abc123'
					}
				}

				export const loginResult = login('test@example.com', 'password')
			`,
			'src/services/auth/index.ts': `
				export * from './login'
			`,
			'src/services/user/profile.ts': `
				import type { User } from '../../core/types/user'

				export function getProfile(userId: number) {
					return {
						userId,
						bio: 'Test bio',
						createdAt: new Date()
					}
				}

				export const defaultProfile = getProfile(1)
			`,
			'src/services/user/index.ts': `
				export * from './profile'
			`,
			'src/services/index.ts': `
				export * from './auth'
				export * from './user'
			`,
			'src/index.ts': `
				export * from './core'
				export * from './services'
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
		})

		expect(files[0].dts).toContain('interface User')
		expect(files[0].dts).toContain('declare function validateEmail')
		expect(files[0].dts).toContain('declare const MIN_PASSWORD_LENGTH')
		expect(files[0].dts).toContain('declare function login')
		expect(files[0].dts).toContain('declare const loginResult')
		expect(files[0].dts).toContain('declare function getProfile')
		expect(files[0].dts).toContain('declare const defaultProfile')
	})

	test('should handle very deep imports (5+ levels) with inferTypes', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/level1/level2/level3/level4/level5/deep.ts': `
				export function deepFunction(x: number) {
					return x * x
				}

				export const DEEP_CONSTANT = 42
			`,
			'src/level1/level2/level3/level4/level5/index.ts': `
				export * from './deep'
			`,
			'src/level1/level2/level3/level4/index.ts': `
				export * from './level5'
			`,
			'src/level1/level2/level3/index.ts': `
				export * from './level4'
			`,
			'src/level1/level2/index.ts': `
				export * from './level3'
			`,
			'src/level1/index.ts': `
				export * from './level2'
			`,
			'src/index.ts': `
				import { deepFunction, DEEP_CONSTANT } from './level1/level2/level3/level4/level5/deep'

				export function useDeepFunction() {
					return deepFunction(10)
				}

				export const result = useDeepFunction()
				export const doubled = DEEP_CONSTANT * 2
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
		})

		expect(files[0].dts).toContain('declare function useDeepFunction')
		expect(files[0].dts).toContain('declare const result')
		expect(files[0].dts).toContain('declare const doubled')
	})

	test('should handle cross-directory imports with inferTypes', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/moduleA/utils.ts': `
				export function helperA(x: number) {
					return x + 1
				}
			`,
			'src/moduleB/utils.ts': `
				import { helperA } from '../moduleA/utils'

				export function helperB(x: number) {
					return helperA(x) * 2
				}
			`,
			'src/moduleC/utils.ts': `
				import { helperB } from '../moduleB/utils'
				import { helperA } from '../moduleA/utils'

				export function helperC(x: number) {
					return helperA(x) + helperB(x)
				}
			`,
			'src/moduleD/index.ts': `
				import { helperC } from '../moduleC/utils'
				import { helperB } from '../moduleB/utils'
				import { helperA } from '../moduleA/utils'

				export function combined(x: number) {
					return helperA(x) + helperB(x) + helperC(x)
				}

				export const result = combined(5)
			`,
			'src/index.ts': `
				export * from './moduleD'
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
		})

		expect(files[0].dts).toContain('declare function combined')
		expect(files[0].dts).toContain('declare const result')
	})

	test('should handle functions without return types across multiple files', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/math/operations.ts': `
				export function add(a: number, b: number) {
					return a + b
				}

				export function multiply(a: number, b: number) {
					return a * b
				}

				export function divide(a: number, b: number) {
					if (b === 0) throw new Error('Division by zero')
					return a / b
				}

				export function calculate(operation: string, a: number, b: number) {
					switch (operation) {
						case 'add': return add(a, b)
						case 'multiply': return multiply(a, b)
						case 'divide': return divide(a, b)
						default: throw new Error('Unknown operation')
					}
				}
			`,
			'src/string/operations.ts': `
				export function concat(a: string, b: string) {
					return a + b
				}

				export function repeat(str: string, times: number) {
					return str.repeat(times)
				}

				export function transform(str: string) {
					return {
						upper: str.toUpperCase(),
						lower: str.toLowerCase(),
						length: str.length
					}
				}
			`,
			'src/array/operations.ts': `
				export function sum(numbers: number[]) {
					return numbers.reduce((acc, n) => acc + n, 0)
				}

				export function average(numbers: number[]) {
					return sum(numbers) / numbers.length
				}

				export function filterPositive(numbers: number[]) {
					return numbers.filter(n => n > 0)
				}

				export function mapDouble(numbers: number[]) {
					return numbers.map(n => n * 2)
				}
			`,
			'src/index.ts': `
				import { add, multiply, calculate } from './math/operations'
				import { concat, transform } from './string/operations'
				import { sum, average, filterPositive } from './array/operations'

				export function complexCalculation(x: number, y: number) {
					const result1 = add(x, y)
					const result2 = multiply(result1, 2)
					return calculate('divide', result2, x)
				}

				export function processData(items: number[]) {
					const positive = filterPositive(items)
					const total = sum(positive)
					const avg = average(positive)
					return { total, avg, count: positive.length }
				}

				export function stringOps(a: string, b: string) {
					const combined = concat(a, b)
					return transform(combined)
				}

				export const calcResult = complexCalculation(10, 5)
				export const dataResult = processData([1, -2, 3, -4, 5])
				export const stringResult = stringOps('Hello', 'World')
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
		})

		expect(files[0].dts).toContain('declare function complexCalculation')
		expect(files[0].dts).toContain('declare function processData')
		expect(files[0].dts).toContain('declare function stringOps')
		expect(files[0].dts).toContain('declare const calcResult: number')
		expect(files[0].dts).toContain('declare const dataResult')
		expect(files[0].dts).toContain('declare const stringResult')
	})

	test('should handle variables without explicit types in nested structure', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/config/database.ts': `
				export const dbConfig = {
					host: 'localhost',
					port: 5432,
					database: 'mydb',
					maxConnections: 10
				}

				export const connectionString = \`postgresql://\${dbConfig.host}:\${dbConfig.port}/\${dbConfig.database}\`
			`,
			'src/config/api.ts': `
				export const apiConfig = {
					baseUrl: 'https://api.example.com',
					timeout: 5000,
					headers: {
						'Content-Type': 'application/json'
					}
				}

				export const endpoints = {
					users: apiConfig.baseUrl + '/users',
					posts: apiConfig.baseUrl + '/posts',
					comments: apiConfig.baseUrl + '/comments'
				}
			`,
			'src/config/app.ts': `
				import { dbConfig } from './database'
				import { apiConfig } from './api'

				export const appConfig = {
					name: 'MyApp',
					version: '1.0.0',
					env: process.env.NODE_ENV || 'development',
					database: dbConfig,
					api: apiConfig,
					features: {
						enableCache: true,
						enableLogging: true,
						maxRetries: 3
					}
				}

				export const isProduction = appConfig.env === 'production'
				export const isDevelopment = appConfig.env === 'development'
			`,
			'src/services/api-client.ts': `
				import { apiConfig, endpoints } from '../config/api'

				export const client = {
					baseUrl: apiConfig.baseUrl,
					timeout: apiConfig.timeout,
					endpoints: endpoints,
					request: async (url: string) => {
						return fetch(url)
					}
				}

				export const userEndpoint = client.endpoints.users
			`,
			'src/index.ts': `
				import { appConfig, isProduction } from './config/app'
				import { client, userEndpoint } from './services/api-client'
				import { connectionString } from './config/database'

				export const config = appConfig
				export const prod = isProduction
				export const apiClient = client
				export const dbString = connectionString
				export const users = userEndpoint

				export const combinedConfig = {
					...appConfig,
					client: apiClient,
					db: dbString
				}
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
		})

		expect(files[0].dts).toContain('declare const config')
		expect(files[0].dts).toContain('declare const prod')
		expect(files[0].dts).toContain('declare const apiClient')
		expect(files[0].dts).toContain('declare const dbString')
		expect(files[0].dts).toContain('declare const users')
		expect(files[0].dts).toContain('declare const combinedConfig')
	})

	test('should handle mixed functions and variables without types in deep structure', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/a/b/c/d/e/deep.ts': `
				export function processNumber(n: number) {
					return n * 2
				}

				export const computed = processNumber(21)
			`,
			'src/a/b/c/d/mid.ts': `
				import { processNumber, computed } from './e/deep'

				export function midFunction(x: number) {
					return processNumber(x) + computed
				}

				export const midValue = midFunction(10)
			`,
			'src/a/b/c/shallow.ts': `
				import { midFunction, midValue } from './d/mid'

				export function shallowFunction(y: number) {
					return midFunction(y) * 2
				}

				export const shallowValue = shallowFunction(5) + midValue
			`,
			'src/a/b/upper.ts': `
				import { shallowFunction, shallowValue } from './c/shallow'

				export const upperValue = shallowValue + 100

				export function upperFunction() {
					return shallowFunction(upperValue)
				}

				export const result = upperFunction()
			`,
			'src/index.ts': `
				import { upperFunction, upperValue, result } from './a/b/upper'

				export function main() {
					return {
						upper: upperValue,
						result: result,
						computed: upperFunction()
					}
				}

				export const finalResult = main()
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
		})

		expect(files[0].dts).toContain('declare function main')
		expect(files[0].dts).toContain('declare const finalResult')
	})

	test('should handle circular-like imports with inferTypes', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/a.ts': `
				import { helperB } from './b'

				export function helperA(n: number) {
					if (n <= 0) return 1
					return n + helperB(n - 1)
				}

				export const resultA = helperA(3)
			`,
			'src/b.ts': `
				export function helperB(n: number) {
					if (n <= 0) return 0
					return n * 2
				}

				export const resultB = helperB(5)
			`,
			'src/c.ts': `
				import { helperA, resultA } from './a'
				import { helperB, resultB } from './b'

				export function combineResults() {
					return resultA + resultB
				}

				export const combined = combineResults()

				export function useHelpers(x: number) {
					return helperA(x) + helperB(x)
				}
			`,
			'src/index.ts': `
				export * from './a'
				export * from './b'
				export * from './c'
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
		})

		expect(files[0].dts).toContain('declare function helperA')
		expect(files[0].dts).toContain('declare function helperB')
		expect(files[0].dts).toContain('declare function combineResults')
		expect(files[0].dts).toContain('declare const resultA')
		expect(files[0].dts).toContain('declare const resultB')
		expect(files[0].dts).toContain('declare const combined')
	})
})
