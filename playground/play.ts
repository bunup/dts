import { generateDts } from '../src'

console.time('time')
const result = await generateDts(['src/index.ts'], {
	cwd: 'playground',
})
for (const file of result.files) {
	await Bun.write(`playground/dist/${file.outputPath}`, file.dts)
}
console.timeEnd('time')
