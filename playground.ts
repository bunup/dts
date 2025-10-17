import { generateDts } from './src'

console.time('time')
await generateDts(['src/index.ts'], {
	inferTypes: true,
})
console.timeEnd('time')

// console.log(result.files[0].dts)
