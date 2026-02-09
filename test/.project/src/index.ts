
					import type { Format, Config, Result } from './lib'

					export function createConfig(format: Format): Config {
						return { format, pretty: true }
					}

					export type { Format, Result }
				