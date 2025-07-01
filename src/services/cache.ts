import ConfigStore from 'configstore';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

export class CacheService {
    private cacheStore: ConfigStore;
    private cacheDurationMs: number;

    constructor(cacheDurationDays: number = 7) {
        this.cacheStore = new ConfigStore('jira-cli-cache');
        this.cacheDurationMs = cacheDurationDays * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    }

    get<T>(key: string): T | null {
        const entry = this.cacheStore.get(key) as CacheEntry<T>;
        if (entry && (Date.now() - entry.timestamp < this.cacheDurationMs)) {
            return entry.data;
        }
        return null;
    }

    set<T>(key: string, data: T): void {
        this.cacheStore.set(key, { data, timestamp: Date.now() });
    }

    clear(key?: string): void {
        if (key) {
            this.cacheStore.delete(key);
        } else {
            this.cacheStore.clear();
        }
    }
}