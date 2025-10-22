export interface Repository<T extends { id: string }> {
	findById(id: string): Promise<T | null>
	save(entity: T): Promise<T>
	delete(id: string): Promise<void>
}

export interface PaginatedResponse<T> {
	data: T[]
	total: number
	page: number
	limit: number
}

export interface ApiClient<T = any> {
	get<U = T>(url: string): Promise<PaginatedResponse<U>>
	post<U = T>(url: string, data: U): Promise<U>
}
