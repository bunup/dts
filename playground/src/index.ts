export default function* (): Generator<number, void, unknown> {
	yield 1
	yield 2
	yield 3
}

import type { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'

export const some: NodejsFunction | null = null
