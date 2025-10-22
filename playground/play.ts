import { generateDts } from '../src'

console.time('time')
const result = await generateDts(['zod/packages/zod/src/index.ts'], {})
for (const file of result.files) {
	await Bun.write(`playground/dist/${file.outputPath}`, file.dts)
}
console.timeEnd('time')
