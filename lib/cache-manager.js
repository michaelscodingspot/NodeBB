/* eslint-disable linebreak-style */
/* eslint-disable strict */
class CacheManager {
	constructor(expirationMinutes = 5) {
		this.cache = new Map();
		this.expirationMinutes = expirationMinutes;

		// Start cleanup interval (runs every minute)
		this.cleanupInterval = setInterval(() => {
			this.removeExpiredItems();
		}, 60 * 1000);
	}

	set(key, value) {
		this.cache.set(key, {
			value,
			timestamp: Date.now()
		});
	}

	get(key) {
		const item = this.cache.get(key);
		if (!item) return null;

		// Check if item has expired
		if (this.isExpired(item.timestamp)) {
			this.cache.delete(key);
			return null;
		}

		return item.value;
	}

	isExpired(timestamp) {
		const now = Date.now();
		const expirationMs = this.expirationMinutes * 60 * 1000;
		return (now - timestamp) > expirationMs;
	}

	removeExpiredItems() {
		const now = Date.now();
		for (const [key, item] of this.cache.entries()) {
			if (this.isExpired(item.timestamp)) {
				this.cache.delete(key);
			}
		}
	}

	clear() {
		this.cache.clear();
	}

	stop() {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}
	}
}

module.exports = CacheManager;