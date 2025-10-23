import { rm } from 'node:fs/promises'
import path from 'node:path'
import type { BunPlugin } from 'bun'
import { isolatedDeclaration, type OxcError } from 'oxc-transform'
import { resolveTsImportPath } from 'ts-import-resolver'

import { EMPTY_EXPORT } from './constants'
import { dtsToFakeJs, fakeJsToDts } from './fake'
import type { IsolatedDeclarationError } from './isolated-decl-logger'
import type {
	GenerateDtsOptions,
	GenerateDtsResult,
	GenerateDtsResultFile,
} from './options'
import { NODE_MODULES_RE } from './re'
import { createResolver } from './resolver'
import { runTypescriptCompiler } from './typescript-compiler'
import {
	cleanPath,
	deleteExtension,
	filterTypescriptFiles,
	generateRandomString,
	getDeclarationExtensionFromJsExtension,
	getExtension,
	getFilesFromGlobs,
	isTypeScriptFile,
	loadTsConfig,
	minifyDts,
	replaceExtension,
} from './utils'

export async function generateDts(
	entrypoints: string[],
	options: GenerateDtsOptions = {},
): Promise<GenerateDtsResult> {
	const { resolve, preferredTsconfig, naming } = options
	const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd()

	const tsconfig = await loadTsConfig(cwd, preferredTsconfig)

	if (options.inferTypes && !tsconfig.filepath) {
		throw new Error(
			'The "inferTypes" option requires a tsconfig.json file. Please create a tsconfig.json file in your project root with at least a basic configuration:\n\n' +
				'{\n' +
				'  "compilerOptions": {\n' +
				'    "target": "ESNext",\n' +
				'    "module": "ESNext",\n' +
				'    "moduleResolution": "bundler",\n' +
				'    "declaration": true\n' +
				'  }\n' +
				'}\n\n' +
				'Alternatively, you can specify a custom path using the "preferredTsconfig" option.',
		)
	}

	const nonAbsoluteEntrypoints = entrypoints.filter(
		(entrypoint) => !path.isAbsolute(entrypoint),
	)

	const resolvedEntrypoints = await getFilesFromGlobs(
		nonAbsoluteEntrypoints,
		cwd,
	)

	const absoluteEntrypoints = entrypoints.filter((entrypoint) =>
		path.isAbsolute(entrypoint),
	)

	if (
		!filterTypescriptFiles([...resolvedEntrypoints, ...absoluteEntrypoints])
			.length
	) {
		throw new Error(
			'One or more of the entrypoints you provided do not exist. Please check that each entrypoint points to a valid file.',
		)
	}

	const collectedErrors: IsolatedDeclarationError[] = []

	const resolver = createResolver({
		cwd,
		resolveOption: resolve,
		tsconfig: tsconfig.filepath,
	})

	let tsCompiledDist: string | undefined

	try {
		const fakeJsPlugin: BunPlugin = {
			name: 'fake-js',
			async setup(build) {
				build.onResolve({ filter: /.*/ }, (args) => {
					if (!NODE_MODULES_RE.test(args.importer)) {
						const resolved = resolveTsImportPath({
							importer: args.importer,
							path: args.path,
							cwd,
							tsconfig: tsconfig.config,
						})

						if (resolved && isTypeScriptFile(resolved)) {
							return { path: resolved }
						}
					}

					const resolvedFromNodeModules = resolver(args.path, args.importer)

					if (resolvedFromNodeModules) {
						return { path: resolvedFromNodeModules }
					}

					return {
						path: args.path,
						external: true,
					}
				})

				if (options.inferTypes) {
					tsCompiledDist = await runTypescriptCompiler(
						cwd,
						!!options.tsgo,
						tsconfig.filepath ?? undefined,
					)
				}

				build.onLoad(
					{ filter: /\.(ts|tsx|d\.ts|d\.mts|d\.cts)$/ },
					async (args) => {
						const sourceText = await Bun.file(args.path).text()

						let declaration = ''
						let isolatedDeclarationErrors: OxcError[] = []

						if (NODE_MODULES_RE.test(args.path)) {
							declaration = sourceText
						} else {
							if (options.inferTypes && tsCompiledDist) {
								const relativePath = path.relative(cwd, args.path)
								const declarationPath = replaceExtension(
									path.join(tsCompiledDist, relativePath),
									'.d.ts',
								)

								declaration = await Bun.file(declarationPath).text()
							} else {
								const isolatedDeclarationResult = isolatedDeclaration(
									args.path,
									sourceText,
								)
								declaration = isolatedDeclarationResult.code
								if (isolatedDeclarationResult.errors) {
									isolatedDeclarationErrors = isolatedDeclarationResult.errors
								}
							}
						}

						let fakeJsContent = ''

						if (!collectedErrors.some((e) => e.file === args.path)) {
							for (const error of isolatedDeclarationErrors) {
								collectedErrors.push({
									error,
									file: args.path,
									content: sourceText,
								})
							}
						}

						if (declaration) {
							fakeJsContent = await dtsToFakeJs(declaration)
						} else {
							fakeJsContent = EMPTY_EXPORT
						}

						return {
							loader: 'js',
							contents: fakeJsContent,
						}
					},
				)
			},
		}

		const result = await Bun.build({
			entrypoints: [
				...filterTypescriptFiles(resolvedEntrypoints).map((entry) =>
					path.resolve(path.join(cwd, entry)),
				),
				...filterTypescriptFiles(absoluteEntrypoints),
			],
			format: 'esm',
			target: 'node',
			naming,
			splitting: options.splitting,
			plugins: [fakeJsPlugin],
			packages: 'external',
			minify: options.minify,
			throw: false,
			tsconfig: options.preferredTsconfig
				? path.resolve(cwd, options.preferredTsconfig)
				: undefined,
		})

		if (!result.success) {
			throw new Error(`DTS bundling failed: ${result.logs}`)
		}

		const outputs = result.outputs.filter(
			(output) => output.kind === 'chunk' || output.kind === 'entry-point',
		)

		const bundledFiles: GenerateDtsResultFile[] = []

		for (const output of outputs) {
			const bundledFakeJsContent = await output.text()

			const dtsContent = await fakeJsToDts(bundledFakeJsContent)

			const entrypoint =
				output.kind === 'entry-point'
					? entrypoints[bundledFiles.length]
					: undefined

			const chunkFileName =
				output.kind === 'chunk'
					? replaceExtension(
							path.basename(output.path),
							getDeclarationExtensionFromJsExtension(getExtension(output.path)),
						)
					: undefined

			const outputPath = cleanPath(
				replaceExtension(
					cleanPath(output.path),
					getDeclarationExtensionFromJsExtension(getExtension(output.path)),
				),
			)

			const treeshakedDts = isolatedDeclaration(
				`${generateRandomString()}.d.ts`,
				dtsContent,
			)

			if (!treeshakedDts.code.length && !treeshakedDts.errors.length) {
				continue
			}

			if (treeshakedDts.errors.length && !treeshakedDts.code) {
				throw new Error(
					`DTS treeshaking failed for ${entrypoint || outputPath}\n\n${JSON.stringify(treeshakedDts.errors, null, 2)}`,
				)
			}

			bundledFiles.push({
				kind: output.kind === 'entry-point' ? 'entry-point' : 'chunk',
				entrypoint,
				chunkFileName,
				outputPath,
				dts: options.minify
					? minifyDts(treeshakedDts.code)
					: treeshakedDts.code,
				pathInfo: {
					outputPathWithoutExtension: deleteExtension(outputPath),
					ext: getExtension(outputPath),
				},
			})
		}

		return {
			files: bundledFiles,
			errors: collectedErrors,
		}
	} finally {
		if (tsCompiledDist) {
			await rm(tsCompiledDist, { recursive: true, force: true })
		}
	}
}
