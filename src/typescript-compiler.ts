import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

export async function runTypescriptCompiler(
	root: string,
	tsgo: boolean,
	tsconfig?: string,
): Promise<string> {
	let executable = 'tsc'

	if (tsgo) {
		const tsgoPackage = import.meta.resolve(
			'@typescript/native-preview/package.json',
		)
		const { default: getExePath } = await import(
			new URL('lib/getExePath.js', tsgoPackage).href
		)
		executable = getExePath()
	}

	const dist = await mkdtemp(path.join(tmpdir(), 'bunup-dts-'))

	const proc = Bun.spawn([
		executable,
		'--noEmit',
		'false',
		'--declaration',
		'--emitDeclarationOnly',
		'--isolatedDeclarations',
		'false',
		...(tsconfig ? ['-p', tsconfig] : []),
		'--outDir',
		dist,
		'--rootDir',
		root,
		'--noCheck',
	])

	const exitCode = await proc.exited

	if (exitCode !== 0) {
		const stderr = await new Response(proc.stdout).text()
		throw new Error(
			stderr || `TypeScript compiler failed with exit code ${exitCode}`,
		)
	}

	return dist
}
