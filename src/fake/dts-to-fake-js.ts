import { parse } from '@babel/parser'
import {
	assignNameToUnnamedDefaultExport,
	getAllImportNames,
	getCommentText,
	getName,
	hasDefaultExportModifier,
	hasExportModifier,
	isDefaultReExport,
	isExportAllDeclaration,
	isImportDeclaration,
	isLikelyVariableOrTypeName,
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
import {
	generateRandomString,
	generateVarName,
	isNullOrUndefined,
} from '../utils'
import { escapeNewlinesAndTabs } from './utils'

export async function dtsToFakeJs(dtsContent: string): Promise<string> {
	const parsed = parse(dtsContent, {
		sourceType: 'module',
		plugins: ['typescript'],
	})

	const referencedNames = new Set<string>()
	const exportedNames = new Set<string>()
	const result = []

	for (const name of getAllImportNames(parsed.program.body)) {
		referencedNames.add(name)
	}

	for (const [index, statement] of parsed.program.body.entries()) {
		if (
			isNullOrUndefined(statement.start) ||
			isNullOrUndefined(statement.end)
		) {
			continue
		}

		let statementText = dtsContent.substring(statement.start, statement.end)

		const name = getName(statement, dtsContent)

		const jsVarName = name || generateVarName(index)

		if (name) {
			referencedNames.add(name)
		}

		const isDefaultExport = hasDefaultExportModifier(statement, statementText)

		if (isDefaultExport && isUnnamedDefaultExport(statement)) {
			statementText = assignNameToUnnamedDefaultExport(statementText, jsVarName)
			referencedNames.add(jsVarName)
		}

		if (isDefaultExport) {
			result.push(`export { ${jsVarName} as default }`)

			if (isDefaultReExport(statement)) {
				continue
			}
		}

		if (
			isImportDeclaration(statement) ||
			isExportAllDeclaration(statement) ||
			isReExportStatement(statement)
		) {
			if (isSideEffectImport(statement)) {
				continue
			}

			const jsImportExport = jsifyImportExport(statementText)

			result.push(jsImportExport)
			continue
		}

		let leadingComment: string | null = null

		leadingComment = getCommentText(statement.leadingComments)

		let statementTextWithCommentsAttached = `${leadingComment ? `${leadingComment}\n` : ''}${statementText}`

		const isExported = hasExportModifier(statement, statementText)

		if (isExported) {
			statementTextWithCommentsAttached = removeExportSyntaxes(
				statementTextWithCommentsAttached,
			)
		}

		const { tokens, extras } = tokenizeText(
			statementTextWithCommentsAttached,
			referencedNames,
		)

		for (const extra of extras) {
			result.push(extra)
		}

		result.push(`var ${jsVarName} = [${tokens.join(', ')}];`)

		if (
			isExported &&
			// for default export, we are handling the export of it early, see above
			!isDefaultExport &&
			!exportedNames.has(jsVarName)
		) {
			if (isDefaultExport) {
				result.push(`export { ${jsVarName} as default };`)
			} else {
				result.push(`export { ${jsVarName} };`)
			}

			exportedNames.add(jsVarName)
		}
	}

	return result.join('\n')
}

// converts typescript import/export statements to javascript equivalents
// - "import type { Foo } from 'bar'" -> "import { Foo } from 'bar'"
// - "export type { Baz }" -> "export { Baz }"
// - "import { type A, B } from 'mod'" -> "import { A, B } from 'mod'"
// - "import Def, { type Named } from 'lib'" -> "import Def, { Named } from 'lib'"
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

function tokenizeText(
	text: string,
	referencedNames: Set<string>,
): { tokens: string[]; extras: string[] } {
	const tokens = []
	const extras = []

	let match: RegExpExecArray | null

	TOKENIZE_RE.lastIndex = 0

	while (true) {
		match = TOKENIZE_RE.exec(text)
		if (match === null) break

		const token = match[0]

		if (token.startsWith('import(')) {
			const staticImport = convertDynamicImportToStatic(token)
			extras.push(staticImport.declarations)
			tokens.push(staticImport.variableName)
		} else if (
			isLikelyVariableOrTypeName(token) ||
			referencedNames.has(token)
		) {
			tokens.push(token)
		} else {
			tokens.push(JSON.stringify(escapeNewlinesAndTabs(token)))
		}
	}

	return { tokens, extras }
}

function convertDynamicImportToStatic(dynamicImport: string): {
	declarations: string
	variableName: string
} {
	const importMatch = dynamicImport.match(
		/^import\s*\(\s*(['"`])(.+?)\1\s*\)((?:\.[a-zA-Z_$][a-zA-Z0-9_$]*|\[(['"`]).+?\4\])*)$/,
	)
	if (!importMatch) {
		throw new Error('Invalid dynamic import format')
	}
	const modulePath = importMatch[2]
	const propertyAccess = importMatch[3] || ''

	if (!propertyAccess) {
		const importIdentifier = `import_${generateRandomString()}`
		return {
			declarations: `import * as ${importIdentifier} from '${modulePath}';`,
			variableName: importIdentifier,
		}
	}

	const firstProperty = extractFirstProperty(propertyAccess)
	const remainingAccess = propertyAccess.slice(firstProperty.accessLength)

	if (firstProperty.isValidIdentifier) {
		const uniqueName = `${createValidIdentifier(firstProperty.name)}_${generateRandomString()}`
		let declarations = `import { ${firstProperty.name} as ${uniqueName} } from '${modulePath}';`
		let finalVariable = uniqueName

		if (remainingAccess) {
			const lastProperty = extractLastProperty(remainingAccess)
			const varName = `${createValidIdentifier(lastProperty)}_${generateRandomString()}`
			declarations += `\nvar ${varName} = ${uniqueName}${remainingAccess};`
			finalVariable = varName
		}

		return {
			declarations,
			variableName: finalVariable,
		}
	} else {
		const importIdentifier = `import_${generateRandomString()}`
		const lastProperty = extractLastProperty(propertyAccess)
		const varName = `${createValidIdentifier(lastProperty)}_${generateRandomString()}`
		const declarations = `import * as ${importIdentifier} from '${modulePath}';\nvar ${varName} = ${importIdentifier}${propertyAccess};`

		return {
			declarations,
			variableName: varName,
		}
	}
}

function extractFirstProperty(propertyAccess: string): {
	name: string
	accessLength: number
	isValidIdentifier: boolean
} {
	const dotMatch = propertyAccess.match(/^\.([a-zA-Z_$][a-zA-Z0-9_$]*)/)
	if (dotMatch) {
		return {
			name: dotMatch[1] as string,
			accessLength: dotMatch[0].length,
			isValidIdentifier: true,
		}
	}

	const bracketMatch = propertyAccess.match(/^\[(['"`])(.+?)\1\]/)
	if (bracketMatch) {
		const propName = bracketMatch[2]
		const isValid = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(propName as string)
		return {
			name: propName as string,
			accessLength: bracketMatch[0].length,
			isValidIdentifier: isValid,
		}
	}

	throw new Error('Invalid property access')
}

function extractLastProperty(propertyAccess: string): string {
	const bracketMatch = propertyAccess.match(/\[(['"`])(.+?)\1\]$/)
	if (bracketMatch) {
		return bracketMatch[2] as string
	}
	const dotMatch = propertyAccess.match(/\.([a-zA-Z_$][a-zA-Z0-9_$]*)$/)
	if (dotMatch) {
		return dotMatch[1] as string
	}
	return 'value'
}

function createValidIdentifier(name: string): string {
	let identifier = name.replace(/[^a-zA-Z0-9_$]/g, '_')
	if (/^\d/.test(identifier)) {
		identifier = `_${identifier}`
	}
	if (!identifier) {
		identifier = '_value'
	}
	return identifier
}
