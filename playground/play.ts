import { generateDts } from '../src'

console.time('time')
const result = await generateDts(['playground/src/index.ts'])
console.timeEnd('time')
for (const file of result.files) {
	await Bun.write(`playground/dist/${file.outputPath}`, file.dts)
}
