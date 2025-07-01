export declare class CacheService {
    private cacheStore;
    private cacheDurationMs;
    constructor(cacheDurationDays?: number);
    get<T>(key: string): T | null;
    set<T>(key: string, data: T): void;
    clear(key?: string): void;
}
