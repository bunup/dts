if (!Array.prototype.includes) {
	Array.prototype.includes = function (searchElement) {
		return this.indexOf(searchElement) !== -1
	}
}
