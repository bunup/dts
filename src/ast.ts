import type {
	CommentBlock,
	CommentLine,
	Declaration,
	Directive,
	ExportDefaultDeclaration,
	ExportNamedDeclaration,
	ImportDeclaration,
	Node,
	Statement,
} from '@babel/types'

import { CAPITAL_LETTER_RE, EXPORT_DEFAULT_RE, EXPORT_RE } from './re'

export function isLikelyVariableOrTypeName(token: string): boolean {
	return (
		CAPITAL_LETTER_RE.test(token) &&
		!token.startsWith('/*') &&
		!token.startsWith('@') &&
		!token.startsWith('"') &&
		!token.startsWith("'") &&
		!token.startsWith('`')
	)
}

export function isImportDeclaration(node: Node): boolean {
	return node.type === 'ImportDeclaration'
}

export function removeExportSyntaxes(text: string): string {
	return text.replace(EXPORT_DEFAULT_RE, '').replace(EXPORT_RE, '')
}

export function isExportAllDeclaration(node: Node): boolean {
	return node.type === 'ExportAllDeclaration'
}

export function isReExportStatement(node: Node): boolean {
	return node.type === 'ExportNamedDeclaration' && !node.declaration
}

export function isSideEffectImport(node: Node): boolean {
	return node.type === 'ImportDeclaration' && node.specifiers.length === 0
}

export function hasExportModifier(node: Node, text: string): boolean {
	return node.type.startsWith('Export') || text.trim().startsWith('export')
}

export function hasDefaultExportModifier(node: Node, text: string): boolean {
	return (
		node.type === 'ExportDefaultDeclaration' ||
		text.trim().startsWith('export default')
	)
}

export function isDefaultReExport(node: Node): boolean {
	return (
		node.type === 'ExportDefaultDeclaration' &&
		node.declaration?.type === 'Identifier'
	)
}

// checks if a node is an unnamed default export (e.g., `export default function() {}` or `export default class {}`)
// These exports need to be assigned a variable name before fake-js transformation
export function isUnnamedDefaultExport(node: Node): boolean {
	if (node.type !== 'ExportDefaultDeclaration') {
		return false
	}

	const declaration = node.declaration

	if (!declaration) {
		return false
	}

	// check for unnamed function declarations
	if (
		(declaration.type === 'FunctionDeclaration' ||
			declaration.type === 'TSDeclareFunction') &&
		!declaration.id
	) {
		return true
	}

	// check for unnamed class declarations
	if (declaration.type === 'ClassDeclaration' && !declaration.id) {
		return true
	}

	return false
}

// assigns a variable name to an unnamed default export by converting:
// - `export default function() {}` -> `export default function varName() {}`
// - `export default class {}` -> `export default class varName {}`
// returns the modified text with the name inserted
export function assignNameToUnnamedDefaultExport(
	text: string,
	varName: string,
): string {
	const functionPattern = /export\s+default\s+function\s*([(<])/
	const functionMatch = text.match(functionPattern)

	if (functionMatch) {
		return text.replace(functionPattern, `export default function ${varName}$1`)
	}

	const classPattern = /export\s+default\s+class\s*([{]|extends|implements)/
	const classMatch = text.match(classPattern)

	if (classMatch) {
		return text.replace(classPattern, `export default class ${varName} $1`)
	}

	return text
}

export function getName(
	node:
		| Directive
		| Statement
		| ExportDefaultDeclaration
		| ExportNamedDeclaration
		| Declaration,
	source: string,
): string | null {
	if (!node) return null

	if (node.type === 'ExportNamedDeclaration' && node.declaration) {
		return getName(node.declaration as Declaration, source)
	}

	if (node.type === 'ExportDefaultDeclaration' && node.declaration) {
		if (node.declaration.type === 'Identifier') {
			return node.declaration.name
		}
		return getName(node.declaration as Declaration, source)
	}

	switch (node.type) {
		case 'TSInterfaceDeclaration':
		case 'TSTypeAliasDeclaration':
		case 'ClassDeclaration':
		case 'TSEnumDeclaration':
		case 'FunctionDeclaration':
		case 'TSDeclareFunction':
			if (node.id && node.id.type === 'Identifier') {
				return node.id.name
			}
			break

		case 'TSModuleDeclaration':
			if (node.id && node.id.type === 'Identifier') {
				return node.id.name
			}
			break

		case 'VariableDeclaration': {
			const declarations = node.declarations
			if (
				declarations?.length === 1 &&
				declarations[0]?.id?.type === 'Identifier'
			) {
				return declarations[0].id.name
			}
			break
		}
	}
	return null
}

export function getCommentText(
	comments: (CommentBlock | CommentLine)[] | undefined | null,
): string | null {
	if (!comments) return null
	return comments
		.map((comment) => {
			return comment.type === 'CommentBlock'
				? `/*${comment.value}*/`
				: comment.type === 'CommentLine'
					? `//${comment.value}`
					: null
		})
		.join('\n')
}

export function getAllImportNames(body: Statement[]): string[] {
	const importNames: string[] = []

	for (const statement of body) {
		if (isImportDeclaration(statement)) {
			const importDecl = statement as ImportDeclaration

			if (importDecl.specifiers) {
				for (const specifier of importDecl.specifiers) {
					if (specifier.type === 'ImportDefaultSpecifier') {
						importNames.push(specifier.local.name)
					} else if (specifier.type === 'ImportSpecifier') {
						importNames.push(specifier.local.name)
					} else if (specifier.type === 'ImportNamespaceSpecifier') {
						importNames.push(specifier.local.name)
					}
				}
			}
		}
	}

	return importNames
}

/**
 * Extract namespace import aliases mapped to their module specifiers.
 * e.g. `import * as schema from './schema'` → { alias: 'schema', specifier: './schema' }
 */
export function getNamespaceImports(
	body: Statement[],
): { alias: string; specifier: string }[] {
	const result: { alias: string; specifier: string }[] = []

	for (const statement of body) {
		if (isImportDeclaration(statement)) {
			const importDecl = statement as ImportDeclaration

			if (importDecl.specifiers) {
				for (const specifier of importDecl.specifiers) {
					if (specifier.type === 'ImportNamespaceSpecifier') {
						result.push({
							alias: specifier.local.name,
							specifier: importDecl.source.value,
						})
					}
				}
			}
		}
	}

	return result
}
