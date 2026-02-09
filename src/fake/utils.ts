// intermediate markers used during fake-js transformation
// these are used to escape special characters that would otherwise be mangled by bundlers
export const MARKERS = {
	NEWLINE: '\uE000_NL_\uE000',
	TAB: '\uE001_TB_\uE001',
} as const

// escapes newlines and tabs to prevent bun bundler from converting tokens/strings
// to template literals and escaping backticks/etc in the final fake-js bundle.
// https://github.com/bunup/bunup/issues/63
export function escapeNewlinesAndTabs(text: string): string {
	return text.replace(/\n/g, MARKERS.NEWLINE).replace(/\t/g, MARKERS.TAB)
}

// unescapes previously escaped newlines and tabs back to actual characters.
export function unescapeNewlinesAndTabs(text: string): string {
	return text
		.replace(new RegExp(MARKERS.NEWLINE, 'g'), '\n')
		.replace(new RegExp(MARKERS.TAB, 'g'), '\t')
}

export function generateFixedStringFromString(str: string): string {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash
	}
	return Math.abs(hash).toString(36)
}

export function convertDynamicImportToStatic(dynamicImport: string): {
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
		const importIdentifier = `import_${generateFixedStringFromString(modulePath ?? 'import')}`
		return {
			declarations: `import * as ${importIdentifier} from '${modulePath}';`,
			variableName: importIdentifier,
		}
	}

	const firstProperty = extractFirstProperty(propertyAccess)
	const remainingAccess = propertyAccess.slice(firstProperty.accessLength)

	if (firstProperty.isValidIdentifier) {
		const uniqueName = `${createValidIdentifier(firstProperty.name)}_${generateFixedStringFromString(firstProperty.name)}`
		let declarations = `import { ${firstProperty.name} as ${uniqueName} } from '${modulePath}';`
		let finalVariable = uniqueName

		if (remainingAccess) {
			const lastProperty = extractLastProperty(remainingAccess)
			const varName = `${createValidIdentifier(lastProperty)}_${generateFixedStringFromString(lastProperty)}`
			declarations += `\nvar ${varName} = ${uniqueName}${remainingAccess};`
			finalVariable = varName
		}

		return {
			declarations,
			variableName: finalVariable,
		}
	} else {
		const importIdentifier = `import_${generateFixedStringFromString(modulePath ?? 'import')}`
		const lastProperty = extractLastProperty(propertyAccess)
		const varName = `${createValidIdentifier(lastProperty)}_${generateFixedStringFromString(lastProperty)}`
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
