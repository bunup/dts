import { generateDts } from './src'

console.time('time')
const result = await generateDts(['src/index.ts'], {
	inferTypes: true,
})
console.log(result.files[0].dts)
console.timeEnd('time')
