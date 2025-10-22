import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import type { File } from '@babel/types'
import * as t from '@babel/types'
import {
	assignNameToUnnamedDefaultExport,
	getCommentText,
	getName,
	hasDefaultExportModifier,
	hasExportModifier,
	isDefaultReExport,
	isReExportStatement,
	isSideEffectImport,
	isUnnamedDefaultExport,
	removeExportSyntaxes,
} from '../ast'
import {
	EXPORT_TYPE_RE,
	IMPORT_EXPORT_NAMES_RE,
	IMPORT_EXPORT_WITH_DEFAULT_RE,
	IMPORT_TYPE_RE,
	TOKENIZE_RE,
	TYPE_WORD_RE,
} from '../re'
import { generateVarName, isNullOrUndefined } from '../utils'
import { escapeNewlinesAndTabs } from './utils'

export async function dtsToFakeJs(dtsContent: string): Promise<string> {
	const ast = parse(dtsContent, {
		sourceType: 'module',
		plugins: ['typescript'],
	}) as File

	const fileIdentifiers = new Set<string>()
	traverse(ast, {
		Identifier(path) {
			fileIdentifiers.add(path.node.name)
		},
	})

	const exportedNames = new Set<string>()
	const result: string[] = []

	for (const [index, statement] of ast.program.body.entries()) {
		if (
			isNullOrUndefined(statement.start) ||
			isNullOrUndefined(statement.end)
		) {
			continue
		}

		let statementText = dtsContent.substring(statement.start, statement.end)

		const name = getName(statement, dtsContent)
		const jsVarName = name || generateVarName(index)

		const isDefaultExport = hasDefaultExportModifier(statement, statementText)

		if (isDefaultExport && isUnnamedDefaultExport(statement)) {
			statementText = assignNameToUnnamedDefaultExport(statementText, jsVarName)
		}

		if (isDefaultExport) {
			result.push(`export { ${jsVarName} as default }`)

			if (isDefaultReExport(statement)) {
				continue
			}
		}

		if (
			t.isImportDeclaration(statement) ||
			t.isExportAllDeclaration(statement) ||
			isReExportStatement(statement)
		) {
			if (isSideEffectImport(statement)) {
				continue
			}

			const jsImportExport = jsifyImportExport(statementText)
			result.push(jsImportExport)
			continue
		}

		const leadingComment = getCommentText(statement.leadingComments)
		let statementTextWithCommentsAttached = `${leadingComment ? `${leadingComment}\n` : ''}${statementText}`

		const isExported = hasExportModifier(statement, statementText)

		if (isExported) {
			statementTextWithCommentsAttached = removeExportSyntaxes(
				statementTextWithCommentsAttached,
			)
		}

		const tokens = tokenize(statementTextWithCommentsAttached, fileIdentifiers)

		result.push(`var ${jsVarName} = [${tokens.join(', ')}];`)

		if (isExported && !isDefaultExport && !exportedNames.has(jsVarName)) {
			result.push(`export { ${jsVarName} };`)
			exportedNames.add(jsVarName)
		}
	}

	return result.join('\n')
}

function jsifyImportExport(text: string): string {
	let result = text
		.replace(IMPORT_TYPE_RE, 'import ')
		.replace(EXPORT_TYPE_RE, 'export ')
		.replace(
			IMPORT_EXPORT_NAMES_RE,
			(_, keyword, names) => `${keyword} {${names.replace(TYPE_WORD_RE, '')}}`,
		)

	result = result.replace(
		IMPORT_EXPORT_WITH_DEFAULT_RE,
		(_, keyword, defaultPart = '', names = '') => {
			const cleanedNames = names.replace(TYPE_WORD_RE, '')
			return `${keyword}${defaultPart}{${cleanedNames}}`
		},
	)

	return result
}

function tokenize(text: string, fileIdentifiers: Set<string>): string[] {
	const tokens: string[] = []

	let match: RegExpExecArray | null
	TOKENIZE_RE.lastIndex = 0
	while (true) {
		match = TOKENIZE_RE.exec(text)
		if (match === null) break

		const token = match[0]

		if (fileIdentifiers.has(token)) {
			tokens.push(token)
		} else {
			tokens.push(JSON.stringify(escapeNewlinesAndTabs(token)))
		}
	}

	return tokens
}
