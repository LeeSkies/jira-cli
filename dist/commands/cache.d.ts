export declare class CacheCommand {
    private cacheService;
    constructor();
    execute(cacheType?: string): Promise<void>;
    private getCacheKey;
}
