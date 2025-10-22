import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import type {
	Expression,
	ExpressionStatement,
	File,
	Node,
	SpreadElement,
} from '@babel/types'
import * as t from '@babel/types'
import { isNullOrUndefined } from '../utils'
import { unescapeNewlinesAndTabs } from './utils'

export async function fakeJsToDts(fakeJsContent: string): Promise<string> {
	const ast = parse(fakeJsContent, {
		sourceType: 'module',
		attachComment: false,
	}) as File

	const resultParts: string[] = []

	traverse(ast, {
		ImportDeclaration(path) {
			if (
				isNullOrUndefined(path.node.start) ||
				isNullOrUndefined(path.node.end)
			) {
				return
			}

			const statementText = fakeJsContent.substring(
				path.node.start,
				path.node.end,
			)

			resultParts.push(statementText.replace(/.(?:mjs|cjs|js)\b/g, ''))
		},
		ExportAllDeclaration(path) {
			if (
				isNullOrUndefined(path.node.start) ||
				isNullOrUndefined(path.node.end)
			) {
				return
			}

			const statementText = fakeJsContent.substring(
				path.node.start,
				path.node.end,
			)
			resultParts.push(statementText)
		},
		ExportNamedDeclaration(path) {
			if (!path.node.declaration) {
				if (
					isNullOrUndefined(path.node.start) ||
					isNullOrUndefined(path.node.end)
				) {
					return
				}

				const statementText = fakeJsContent.substring(
					path.node.start,
					path.node.end,
				)
				resultParts.push(statementText)
			}
		},
		ExpressionStatement(path) {
			const namespaceDecl = handleNamespace(path.node)
			if (namespaceDecl) {
				resultParts.push(namespaceDecl)
			}
		},
		VariableDeclaration(path) {
			for (const declaration of path.node.declarations) {
				if (t.isArrayExpression(declaration.init)) {
					const dtsContent = processTokenArray(declaration.init)
					if (dtsContent) {
						resultParts.push(dtsContent)
					}
				}
			}
		},
	})

	return resultParts.join('\n')
}

function processTokenArray(arrayLiteral: Node): string | null {
	if (!t.isArrayExpression(arrayLiteral)) {
		return null
	}

	let result = ''

	for (const element of arrayLiteral.elements) {
		if (!element) continue
		const processed = processTokenElement(element)
		if (processed !== null) {
			result += processed
		}
	}

	return result
}

function processTokenElement(
	element: SpreadElement | Expression,
): string | null {
	if (t.isStringLiteral(element)) {
		return unescapeNewlinesAndTabs(element.value)
	}

	if (t.isIdentifier(element)) {
		return element.name
	}

	if (t.isTemplateLiteral(element)) {
		const parts: string[] = []
		parts.push(unescapeNewlinesAndTabs(element.quasis[0]?.value?.raw || ''))
		for (let i = 0; i < element.expressions.length; i++) {
			const expr = element.expressions[i]
			if (expr && t.isIdentifier(expr)) {
				parts.push(expr.name)
			}
			parts.push(
				unescapeNewlinesAndTabs(element.quasis[i + 1]?.value?.raw || ''),
			)
		}
		return parts.join('')
	}
	return null
}

function handleNamespace(stmt: ExpressionStatement): string | null {
	const expr = stmt.expression

	if (
		!expr ||
		!t.isCallExpression(expr) ||
		!t.isIdentifier(expr.callee) ||
		expr.arguments.length !== 2 ||
		!t.isIdentifier(expr.arguments[0]) ||
		!t.isObjectExpression(expr.arguments[1])
	) {
		return null
	}

	const namespaceName = expr.arguments[0].name
	const properties = expr.arguments[1].properties
		.filter((prop) => t.isObjectProperty(prop))
		.map((prop) => {
			if (
				t.isObjectProperty(prop) &&
				t.isIdentifier(prop.key) &&
				t.isArrowFunctionExpression(prop.value) &&
				t.isIdentifier(prop.value.body)
			) {
				const keyName = prop.key.name
				const returnName = prop.value.body.name

				return keyName === returnName ? keyName : `${returnName} as ${keyName}`
			}
			return null
		})
		.filter((prop): prop is string => prop !== null)

	if (properties.length === 0) {
		return null
	}

	return `declare namespace ${namespaceName} {\n  export { ${properties.join(', ')} };\n}`
}
