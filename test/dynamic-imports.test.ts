import { beforeEach, describe, expect, test } from 'bun:test'
import { cleanProjectDir, createProject, runGenerateDts } from './utils'

describe('dynamic imports for types', () => {
	beforeEach(() => {
		cleanProjectDir()
	})

	test('should handle basic dynamic import type', async () => {
		createProject({
			'src/types.ts': `
				export interface User {
					id: number
					name: string
				}
			`,
			'src/index.ts': `
				export type DynamicUser = import('./types').User

				export function getUser(): DynamicUser {
					return { id: 1, name: 'Test' }
				}
			`,
		})

		const files = await runGenerateDts(['src/index.ts'])

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "interface User {
		  	id: number;
		  	name: string;
		  }
		  type DynamicUser = User;
		  declare function getUser(): DynamicUser;
		  export { getUser, DynamicUser };
		  "
		`)
	})

	test('should handle multiple dynamic imports from same module', async () => {
		createProject({
			'src/models.ts': `
				export interface Product {
					id: number
					name: string
					price: number
				}

				export interface Category {
					id: number
					label: string
				}

				export type ProductStatus = 'active' | 'inactive' | 'draft'
			`,
			'src/index.ts': `
				export type DynamicProduct = import('./models').Product
				export type DynamicCategory = import('./models').Category
				export type DynamicStatus = import('./models').ProductStatus

				export function createProduct(name: string, price: number, category: DynamicCategory): DynamicProduct {
					return { id: Date.now(), name, price }
				}
			`,
		})

		const files = await runGenerateDts(['src/index.ts'])

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "interface Product {
		  	id: number;
		  	name: string;
		  	price: number;
		  }
		  interface Category {
		  	id: number;
		  	label: string;
		  }
		  type ProductStatus = "active" | "inactive" | "draft";
		  type DynamicProduct = Product;
		  type DynamicCategory = Category;
		  type DynamicStatus = ProductStatus;
		  declare function createProduct(name: string, price: number, category: DynamicCategory): DynamicProduct;
		  export { createProduct, DynamicStatus, DynamicProduct, DynamicCategory };
		  "
		`)
	})

	test('should handle dynamic imports from multiple modules', async () => {
		createProject({
			'src/user.ts': `
				export interface User {
					id: number
					email: string
				}
			`,
			'src/post.ts': `
				export interface Post {
					id: number
					title: string
					content: string
				}
			`,
			'src/comment.ts': `
				export interface Comment {
					id: number
					text: string
					authorId: number
				}
			`,
			'src/index.ts': `
				export type UserType = import('./user').User
				export type PostType = import('./post').Post
				export type CommentType = import('./comment').Comment

				export interface BlogData {
					user: UserType
					posts: PostType[]
					comments: CommentType[]
				}

				export function getBlogData(userId: number): BlogData {
					return {
						user: { id: userId, email: 'test@example.com' },
						posts: [],
						comments: []
					}
				}
			`,
		})

		const files = await runGenerateDts(['src/index.ts'])

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "interface User {
		  	id: number;
		  	email: string;
		  }
		  interface Post {
		  	id: number;
		  	title: string;
		  	content: string;
		  }
		  interface Comment {
		  	id: number;
		  	text: string;
		  	authorId: number;
		  }
		  type UserType = User;
		  type PostType = Post;
		  type CommentType = Comment;
		  interface BlogData {
		  	user: UserType;
		  	posts: PostType[];
		  	comments: CommentType[];
		  }
		  declare function getBlogData(userId: number): BlogData;
		  export { getBlogData, UserType, PostType, CommentType, BlogData };
		  "
		`)
	})

	test('should handle dynamic import with typeof', async () => {
		createProject({
			'src/config.ts': `
				export const config = {
					apiUrl: 'https://api.example.com',
					timeout: 5000,
					retries: 3
				} as const
			`,
			'src/index.ts': `
				export type ConfigType = typeof import('./config').config

				export function getConfig(): ConfigType {
					return {
						apiUrl: 'https://api.example.com',
						timeout: 5000,
						retries: 3
					}
				}
			`,
		})

		const files = await runGenerateDts(['src/index.ts'])

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "declare const config: {
		  	readonly apiUrl: "https://api.example.com";
		  	readonly timeout: 5000;
		  	readonly retries: 3;
		  };
		  type ConfigType = typeof config;
		  declare function getConfig(): ConfigType;
		  export { getConfig, ConfigType };
		  "
		`)
	})

	test('should handle dynamic import in generic type parameter', async () => {
		createProject({
			'src/entity.ts': `
				export interface Entity {
					id: number
					createdAt: Date
				}
			`,
			'src/index.ts': `
				export type Response<T> = {
					data: T
					status: number
				}

				export type EntityResponse = Response<import('./entity').Entity>

				export function fetchEntity(id: number): EntityResponse {
					return {
						data: { id, createdAt: new Date() },
						status: 200
					}
				}
			`,
		})

		const files = await runGenerateDts(['src/index.ts'])

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "interface Entity {
		  	id: number;
		  	createdAt: Date;
		  }
		  type Response<T> = {
		  	data: T;
		  	status: number;
		  };
		  type EntityResponse = Response<Entity>;
		  declare function fetchEntity(id: number): EntityResponse;
		  export { fetchEntity, Response, EntityResponse };
		  "
		`)
	})

	test('should handle dynamic imports with inferTypes and tsgo enabled', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/types.ts': `
				export interface Config {
					debug: boolean
					version: string
				}
			`,
			'src/index.ts': `
				export type DynamicConfig = import('./types').Config

				export function createConfig(debug: boolean) {
					return {
						debug,
						version: '1.0.0'
					}
				}

				export const defaultConfig = createConfig(false)
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
			tsgo: true,
		})

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "interface Config {
		  	debug: boolean;
		  	version: string;
		  }
		  type DynamicConfig = Config;
		  declare function createConfig(debug: boolean): {
		  	debug: boolean;
		  	version: string;
		  };
		  declare const defaultConfig: {
		  	debug: boolean;
		  	version: string;
		  };
		  export { defaultConfig, createConfig, DynamicConfig };
		  "
		`)
	})

	test('should handle dynamic imports with tsgo enabled', async () => {
		createProject({
			'tsconfig.json': JSON.stringify({
				compilerOptions: {
					target: 'ESNext',
					module: 'ESNext',
					moduleResolution: 'bundler',
					declaration: true,
				},
			}),
			'src/models.ts': `
				export interface Item {
					id: number
					name: string
				}

				export type ItemList = Item[]
			`,
			'src/index.ts': `
				export type DynamicItem = import('./models').Item
				export type DynamicItemList = import('./models').ItemList

				export function getItems() {
					return [{ id: 1, name: 'Item 1' }]
				}

				export const items = getItems()
			`,
		})

		const files = await runGenerateDts(['src/index.ts'], {
			inferTypes: true,
			tsgo: true,
		})

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "interface Item {
		  	id: number;
		  	name: string;
		  }
		  type ItemList = Item[];
		  type DynamicItem = Item;
		  type DynamicItemList = ItemList;
		  declare function getItems(): {
		  	id: number;
		  	name: string;
		  }[];
		  declare const items: {
		  	id: number;
		  	name: string;
		  }[];
		  export { items, getItems, DynamicItemList, DynamicItem };
		  "
		`)
	})

	test('should handle nested dynamic imports in type definitions', async () => {
		createProject({
			'src/base.ts': `
				export interface BaseEntity {
					id: number
				}
			`,
			'src/user.ts': `
				import type { BaseEntity } from './base'

				export interface User extends BaseEntity {
					email: string
				}
			`,
			'src/index.ts': `
				export type DeepUser = import('./user').User
				export type DeepBase = import('./base').BaseEntity

				export interface ExtendedUser {
					user: DeepUser
					metadata: {
						base: DeepBase
						timestamp: number
					}
				}

				export function createExtendedUser(email: string): ExtendedUser {
					return {
						user: { id: 1, email },
						metadata: {
							base: { id: 1 },
							timestamp: Date.now()
						}
					}
				}
			`,
		})

		const files = await runGenerateDts(['src/index.ts'])

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "interface BaseEntity {
		  	id: number;
		  }
		  interface User extends BaseEntity {
		  	email: string;
		  }
		  type DeepUser = User;
		  type DeepBase = BaseEntity;
		  interface ExtendedUser {
		  	user: DeepUser;
		  	metadata: {
		  		base: DeepBase;
		  		timestamp: number;
		  	};
		  }
		  declare function createExtendedUser(email: string): ExtendedUser;
		  export { createExtendedUser, ExtendedUser, DeepUser, DeepBase };
		  "
		`)
	})

	test('should handle same type dynamically imported multiple times', async () => {
		createProject({
			'src/shared.ts': `
				export interface SharedType {
					value: string
					count: number
				}
			`,
			'src/index.ts': `
				export type First = import('./shared').SharedType
				export type Second = import('./shared').SharedType
				export type Third = import('./shared').SharedType

				export interface Container {
					first: First
					second: Second
					third: Third
				}

				export function createContainer(): Container {
					const shared: First = { value: 'test', count: 1 }
					return {
						first: shared,
						second: shared,
						third: shared
					}
				}
			`,
		})

		const files = await runGenerateDts(['src/index.ts'])

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "interface SharedType {
		  	value: string;
		  	count: number;
		  }
		  type First = SharedType;
		  type Second = SharedType;
		  type Third = SharedType;
		  interface Container {
		  	first: First;
		  	second: Second;
		  	third: Third;
		  }
		  declare function createContainer(): Container;
		  export { createContainer, Third, Second, First, Container };
		  "
		`)
	})

	test('should handle dynamic imports in function parameters and return types', async () => {
		createProject({
			'src/request.ts': `
				export interface Request {
					method: string
					url: string
					body?: unknown
				}
			`,
			'src/response.ts': `
				export interface Response {
					status: number
					data: unknown
				}
			`,
			'src/index.ts': `
				export function handleRequest(
					req: import('./request').Request
				): import('./response').Response {
					return {
						status: 200,
						data: { received: req.url }
					}
				}

				export type RequestHandler = (
					request: import('./request').Request
				) => import('./response').Response
			`,
		})

		const files = await runGenerateDts(['src/index.ts'])

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "interface Request {
		  	method: string;
		  	url: string;
		  	body?: unknown;
		  }
		  interface Response {
		  	status: number;
		  	data: unknown;
		  }
		  declare function handleRequest(req: Request): Response;
		  type RequestHandler = (request: Request) => Response;
		  export { handleRequest, RequestHandler };
		  "
		`)
	})

	test('should handle dynamic import from external node package', async () => {
		createProject({
			'src/index.ts': `
				export type NodeBuffer = import('node:buffer').Buffer
				export type NodeStream = import('node:stream').Readable

				export interface FileData {
					buffer: NodeBuffer
					stream: NodeStream
				}

				export function createFileData(buf: NodeBuffer, stream: NodeStream): FileData {
					return { buffer: buf, stream }
				}
			`,
		})

		const files = await runGenerateDts(['src/index.ts'])

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "import { Buffer as Buffer_x36a8w } from "node:buffer";
		  import { Readable as Readable_d9sohc } from "node:stream";
		  type NodeBuffer = Buffer_x36a8w;
		  type NodeStream = Readable_d9sohc;
		  interface FileData {
		  	buffer: NodeBuffer;
		  	stream: NodeStream;
		  }
		  declare function createFileData(buf: NodeBuffer, stream: NodeStream): FileData;
		  export { createFileData, NodeStream, NodeBuffer, FileData };
		  "
		`)
	})

	test('should handle multiple dynamic imports from different external packages', async () => {
		createProject({
			'src/index.ts': `
				export type FsStats = import('node:fs').Stats
				export type PathParsed = import('node:path').ParsedPath
				export type UrlParsed = import('node:url').URL

				export interface FileInfo {
					stats: FsStats
					path: PathParsed
					url: UrlParsed
				}

				export function getFileInfo(stats: FsStats, path: PathParsed, url: UrlParsed): FileInfo {
					return { stats, path, url }
				}
			`,
		})

		const files = await runGenerateDts(['src/index.ts'])

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "import { Stats as Stats_1br2in } from "node:fs";
		  import { ParsedPath as ParsedPath_gt48ae } from "node:path";
		  import { URL as URL_1t1r } from "node:url";
		  type FsStats = Stats_1br2in;
		  type PathParsed = ParsedPath_gt48ae;
		  type UrlParsed = URL_1t1r;
		  interface FileInfo {
		  	stats: FsStats;
		  	path: PathParsed;
		  	url: UrlParsed;
		  }
		  declare function getFileInfo(stats: FsStats, path: PathParsed, url: UrlParsed): FileInfo;
		  export { getFileInfo, UrlParsed, PathParsed, FsStats, FileInfo };
		  "
		`)
	})

	test('should handle same external type dynamically imported multiple times', async () => {
		createProject({
			'src/index.ts': `
				export type BufferA = import('node:buffer').Buffer
				export type BufferB = import('node:buffer').Buffer
				export type BufferC = import('node:buffer').Buffer

				export interface MultiBuffer {
					input: BufferA
					output: BufferB
					temp: BufferC
				}

				export function processBuffers(input: BufferA, output: BufferB): MultiBuffer {
					return {
						input,
						output,
						temp: input
					}
				}
			`,
		})

		const files = await runGenerateDts(['src/index.ts'])

		expect(files[0].dts).toMatchInlineSnapshot(`
		  "import { Buffer as Buffer_x36a8w } from "node:buffer";
		  type BufferA = Buffer_x36a8w;
		  type BufferB = Buffer_x36a8w;
		  type BufferC = Buffer_x36a8w;
		  interface MultiBuffer {
		  	input: BufferA;
		  	output: BufferB;
		  	temp: BufferC;
		  }
		  declare function processBuffers(input: BufferA, output: BufferB): MultiBuffer;
		  export { processBuffers, MultiBuffer, BufferC, BufferB, BufferA };
		  "
		`)
	})
})
