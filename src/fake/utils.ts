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
