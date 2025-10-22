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
import * as t from '@babel/types'

import { EXPORT_DEFAULT_RE, EXPORT_RE } from './re'

export function removeExportSyntaxes(text: string): string {
	return text.replace(EXPORT_DEFAULT_RE, '').replace(EXPORT_RE, '')
}

export function isReExportStatement(
	node: Node,
): node is ExportNamedDeclaration {
	return t.isExportNamedDeclaration(node) && !node.declaration
}

export function isSideEffectImport(node: Node): node is ImportDeclaration {
	return t.isImportDeclaration(node) && node.specifiers.length === 0
}

export function hasExportModifier(node: Node, text: string): boolean {
	return (
		t.isExportDeclaration(node) ||
		t.isExportDefaultDeclaration(node) ||
		t.isExportNamedDeclaration(node) ||
		t.isExportAllDeclaration(node) ||
		text.trim().startsWith('export')
	)
}

export function hasDefaultExportModifier(node: Node, text: string): boolean {
	return (
		t.isExportDefaultDeclaration(node) ||
		text.trim().startsWith('export default')
	)
}

export function isDefaultReExport(
	node: Node,
): node is ExportDefaultDeclaration {
	return (
		t.isExportDefaultDeclaration(node) &&
		node.declaration !== null &&
		t.isIdentifier(node.declaration)
	)
}

export function isUnnamedDefaultExport(node: Node): boolean {
	if (!t.isExportDefaultDeclaration(node)) {
		return false
	}

	const declaration = node.declaration

	if (!declaration) {
		return false
	}

	if (
		(t.isFunctionDeclaration(declaration) ||
			t.isTSDeclareFunction(declaration)) &&
		!declaration.id
	) {
		return true
	}

	if (t.isClassDeclaration(declaration) && !declaration.id) {
		return true
	}

	return false
}

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

	if (t.isExportNamedDeclaration(node) && node.declaration) {
		return getName(node.declaration as Declaration, source)
	}

	if (t.isExportDefaultDeclaration(node) && node.declaration) {
		if (t.isIdentifier(node.declaration)) {
			return node.declaration.name
		}
		return getName(node.declaration as Declaration, source)
	}

	if (
		t.isTSInterfaceDeclaration(node) ||
		t.isTSTypeAliasDeclaration(node) ||
		t.isClassDeclaration(node) ||
		t.isTSEnumDeclaration(node) ||
		t.isFunctionDeclaration(node) ||
		t.isTSDeclareFunction(node)
	) {
		if (node.id && t.isIdentifier(node.id)) {
			return node.id.name
		}
	}

	if (t.isTSModuleDeclaration(node)) {
		if (node.id && t.isIdentifier(node.id)) {
			return node.id.name
		}
	}

	if (t.isVariableDeclaration(node)) {
		const declarations = node.declarations
		if (
			declarations?.length === 1 &&
			declarations[0]?.id &&
			t.isIdentifier(declarations[0].id)
		) {
			return declarations[0].id.name
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
