import { generateDts } from './src'

console.time('time')
const result = await generateDts(['project/index.ts'], {
	inferTypes: true,
	tsgo: true,
})
console.timeEnd('time')

console.log(result.files[0].dts)
