import { generateDts } from './src'

const result = await generateDts(['src/index.ts'], {
	inferTypes: true,
})

console.log(result.files[0].dts)
