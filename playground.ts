import { generateDts } from './src'

console.time('time')
await generateDts(['src/index.ts'])
console.timeEnd('time')
