import './styles.css'

import './config.json'

import './polyfills'

export interface ButtonProps {
	label: string
	disabled?: boolean
}

export function createButton(props: ButtonProps): HTMLElement {
	const button = document.createElement('button')
	button.textContent = props.label
	button.disabled = props.disabled ?? false
	button.className = 'button'
	return button
}

export const VERSION = '1.0.0'
