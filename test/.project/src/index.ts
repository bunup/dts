export interface Config {
	debug: boolean
}

export const VERSION = '1.0.0'

export default class {
	config: Config

	constructor(config: Config) {
		this.config = config
	}

	run() {
		console.log('running with version', VERSION)
	}
}
