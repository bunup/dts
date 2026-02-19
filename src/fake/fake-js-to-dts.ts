import { parse } from '@babel/parser'
import type * as t from '@babel/types'
import type {
	Expression,
	ExpressionStatement,
	Node,
	SpreadElement,
} from '@babel/types'
import {
	isExportAllDeclaration,
	isImportDeclaration,
	isReExportStatement,
} from '../ast'
import { isNullOrUndefined } from '../utils'
import { unescapeNewlinesAndTabs } from './utils'

export async function fakeJsToDts(
	fakeJsContent: string,
	namespaceAliasMap?: Map<string, string>,
): Promise<string> {
	const parseResult = parse(fakeJsContent, {
		sourceType: 'module',
		attachComment: false,
	})

	const program = parseResult.program
	const resultParts = []

	for (const statement of program.body) {
		if (
			isNullOrUndefined(statement.start) ||
			isNullOrUndefined(statement.end)
		) {
			continue
		}

		const statementText = fakeJsContent.substring(
			statement.start,
			statement.end,
		)

		if (
			isImportDeclaration(statement) ||
			isExportAllDeclaration(statement) ||
			isReExportStatement(statement)
		) {
			if (namespaceAliasMap?.size && isReExportStatement(statement)) {
				const fixedText = fixExportSpecifiers(statement, namespaceAliasMap)
				if (fixedText) {
					resultParts.push(fixedText)
					continue
				}
			}

			resultParts.push(statementText)

			continue
		}

		if (statement.type === 'ExpressionStatement') {
			const namespaceDecl = handleNamespace(statement, namespaceAliasMap)
			if (namespaceDecl) {
				resultParts.push(namespaceDecl)
				continue
			}
		}

		if (statement.type === 'VariableDeclaration') {
			for (const declaration of statement.declarations) {
				if (declaration.id.type === 'Identifier') {
					const init = declaration.init

					if (init?.type === 'Identifier') {
						resultParts.push(`type ${declaration.id.name} = ${init.name};`)
					} else if (init?.type === 'MemberExpression') {
						const memberExpr = convertMemberExpressionToComputed(init)
						resultParts.push(`type ${declaration.id.name} = ${memberExpr};`)
					} else if (init?.type === 'CallExpression') {
						const callExpr = convertCallExpressionToString(init)
						resultParts.push(`type ${declaration.id.name} = ${callExpr};`)
					}
				}

				if (declaration.init?.type === 'ArrayExpression') {
					const dtsContent = processTokenArray(
						declaration.init,
						namespaceAliasMap,
					)
					if (dtsContent) {
						resultParts.push(dtsContent)
					}
				}
			}
		}
	}

	return resultParts.join('\n')
}

function convertMemberExpressionToComputed(node: t.MemberExpression): string {
	let object = ''

	if (node.object.type === 'Identifier') {
		object = node.object.name
	} else if (node.object.type === 'MemberExpression') {
		object = convertMemberExpressionToComputed(node.object)
	}

	let property = ''
	if (node.property.type === 'Identifier') {
		property = `'${node.property.name}'`
	} else if (node.property.type === 'StringLiteral') {
		property = `'${node.property.value}'`
	} else if (node.property.type === 'NumericLiteral') {
		property = String(node.property.value)
	}

	return `${object}[${property}]`
}

function convertCallExpressionToString(node: t.CallExpression): string {
	let callee = ''

	if (node.callee.type === 'Identifier') {
		callee = node.callee.name
	} else if (node.callee.type === 'MemberExpression') {
		callee = convertMemberExpressionToComputed(node.callee)
	}

	// Convert arguments
	const args = node.arguments
		.map((arg) => {
			if (arg.type === 'Identifier') {
				return arg.name
			} else if (arg.type === 'StringLiteral') {
				return `'${arg.value}'`
			} else if (arg.type === 'NumericLiteral') {
				return String(arg.value)
			} else if (arg.type === 'MemberExpression') {
				return convertMemberExpressionToComputed(arg)
			}
			// Add more argument types as needed
			return ''
		})
		.filter(Boolean)
		.join(', ')

	return `${callee}(${args})`
}

function processTokenArray(
	arrayLiteral: Node,
	namespaceAliasMap?: Map<string, string>,
): string | null {
	if (arrayLiteral.type !== 'ArrayExpression') {
		return null
	}

	const tokens = []

	for (const element of arrayLiteral.elements) {
		if (!element) continue
		const processed = processTokenElement(element, namespaceAliasMap)
		if (processed !== null) {
			tokens.push(processed)
		}
	}

	return tokens.join('')
}

function processTokenElement(
	element: SpreadElement | Expression,
	namespaceAliasMap?: Map<string, string>,
): string | null {
	if (element.type === 'StringLiteral' && typeof element.value === 'string') {
		return unescapeNewlinesAndTabs(element.value)
	}

	if (element.type === 'Identifier') {
		return namespaceAliasMap?.get(element.name) ?? element.name
	}

	if (element.type === 'TemplateLiteral') {
		const parts = []
		parts.push(unescapeNewlinesAndTabs(element.quasis[0]?.value?.raw || ''))
		for (let i = 0; i < element.expressions.length; i++) {
			const expr = element.expressions[i]
			if (expr?.type === 'Identifier') {
				parts.push(namespaceAliasMap?.get(expr.name) ?? expr.name)
			}
			parts.push(
				unescapeNewlinesAndTabs(element.quasis[i + 1]?.value?.raw || ''),
			)
		}
		return parts.join('')
	}
	return null
}

function handleNamespace(
	stmt: ExpressionStatement,
	namespaceAliasMap?: Map<string, string>,
): string | null {
	const expr = stmt.expression

	if (
		!expr ||
		expr.type !== 'CallExpression' ||
		expr.callee?.type !== 'Identifier' ||
		expr.arguments?.length !== 2 ||
		expr.arguments[0]?.type !== 'Identifier' ||
		expr.arguments[1]?.type !== 'ObjectExpression'
	) {
		return null
	}

	const rawName = expr.arguments[0].name
	const namespaceName = namespaceAliasMap?.get(rawName) ?? rawName
	const properties = expr.arguments[1].properties
		.filter((prop) => prop.type === 'ObjectProperty')
		.map((prop) => {
			if (
				prop.type === 'ObjectProperty' &&
				prop.key.type === 'Identifier' &&
				prop.value.type === 'ArrowFunctionExpression' &&
				prop.value.body.type === 'Identifier'
			) {
				const keyName = prop.key.name
				const returnName = prop.value.body.name

				return keyName === returnName ? keyName : `${returnName} as ${keyName}`
			}
			return null
		})
		.filter(Boolean)

	if (properties.length === 0) {
		return null
	}

	return `declare namespace ${namespaceName} {\n  export { ${properties.join(', ')} };\n}`
}

/**
 * Fix export specifiers that reference Bun's mangled namespace names.
 * e.g. `export { exports_utils as utils }` → `export { utils }`
 * e.g. `export { exports_types as Types }` → `export { Types }`
 */
function fixExportSpecifiers(
	statement: Node,
	namespaceAliasMap: Map<string, string>,
): string | null {
	if (statement.type !== 'ExportNamedDeclaration') {
		return null
	}

	const specifiers = statement.specifiers
	if (!specifiers?.length) {
		return null
	}

	let hasChange = false
	const fixedParts: string[] = []

	for (const spec of specifiers) {
		if (spec.type !== 'ExportSpecifier') {
			return null
		}

		const localName = spec.local.name
		const exportedName =
			spec.exported.type === 'Identifier'
				? spec.exported.name
				: spec.exported.value

		const alias = namespaceAliasMap.get(localName)
		if (alias) {
			hasChange = true
			fixedParts.push(
				alias === exportedName ? exportedName : `${alias} as ${exportedName}`,
			)
		} else {
			fixedParts.push(
				localName === exportedName
					? localName
					: `${localName} as ${exportedName}`,
			)
		}
	}

	if (!hasChange) {
		return null
	}

	return `export { ${fixedParts.join(', ')} };`
}
