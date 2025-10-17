import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

export async function runTsgo(
	root: string,
	tsconfig?: string,
): Promise<string> {
	const tsgoPackage = import.meta.resolve(
		'@typescript/native-preview/package.json',
	)
	const { default: getExePath } = await import(
		new URL('lib/getExePath.js', tsgoPackage).href
	)
	const tsgo = getExePath()

	const dist = await mkdtemp(path.join(tmpdir(), 'bunup-dts-'))

	const proc = Bun.spawn([
		tsgo,
		'--noEmit',
		'false',
		'--declaration',
		'--emitDeclarationOnly',
		...(tsconfig ? ['-p', tsconfig] : []),
		'--outDir',
		dist,
		'--rootDir',
		root,
		'--noCheck',
	])

	await proc.exited

	return dist
}
