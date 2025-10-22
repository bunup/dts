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

const reservedKeywords = new Set([
	'break',
	'case',
	'catch',
	'continue',
	'debugger',
	'default',
	'delete',
	'do',
	'else',
	'finally',
	'for',
	'function',
	'if',
	'in',
	'instanceof',
	'new',
	'return',
	'switch',
	'this',
	'throw',
	'try',
	'typeof',
	'var',
	'void',
	'while',
	'with',

	'class',
	'const',
	'export',
	'extends',
	'import',
	'super',
	'let',
	'static',
	'yield',
	'async',
	'await',

	'enum',
	'implements',
	'interface',
	'package',
	'private',
	'protected',
	'public',
	'abstract',
	'boolean',
	'byte',
	'char',
	'double',
	'final',
	'float',
	'goto',
	'int',
	'long',
	'native',
	'short',
	'synchronized',
	'throws',
	'transient',
	'volatile',

	'arguments',
	'eval',

	'declare',
	'module',
	'namespace',
	'type',
	'readonly',
	'keyof',
	'infer',

	'never',
	'unknown',
	'any',
	'string',
	'number',
	'boolean',
	'symbol',
	'object',
	'undefined',
	'null',
	'bigint',

	'true',
	'false',
	'null',
	'undefined',
	'NaN',
	'Infinity',

	'Array',
	'Object',
	'String',
	'Number',
	'Boolean',
	'Date',
	'RegExp',
	'Error',
	'Math',
	'JSON',
	'Promise',
	'Map',
	'Set',
	'WeakMap',
	'WeakSet',
])

// Checks if a given text is a JavaScript/TypeScript reserved keyword
// that could cause syntax errors when used as an identifier
// @param keyword - The text to check
// @returns true if the keyword is reserved, false otherwise
export function isReservedKeyword(keyword: string): boolean {
	const lowerKeyword = keyword.toLowerCase()

	return reservedKeywords.has(lowerKeyword)
}
