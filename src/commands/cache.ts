import { CacheService } from '../services/cache';
import chalk from 'chalk';
import inquirer from 'inquirer';

export class CacheCommand {
    private cacheService: CacheService;

    constructor() {
        // CacheService is instantiated with a default duration here,
        // but the actual duration from config will be used when JiraService instantiates it.
        // For clearing, the duration doesn't matter, only the keys.
        this.cacheService = new CacheService(); 
    }

    async execute(cacheType?: string): Promise<void> {
        if (cacheType) {
            const key = this.getCacheKey(cacheType);
            if (key === null) {
                console.log(chalk.red(`Invalid cache type: ${cacheType}. Valid types are 'users', 'statuses', 'projects', or 'all'.`));
                return;
            } else if (key === undefined) { // This case is for 'all' which returns undefined from getCacheKey
                const { confirmClearAll } = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'confirmClearAll',
                    message: 'Are you sure you want to clear ALL caches?',
                    default: false
                }]);
    
                if (confirmClearAll) {
                    this.cacheService.clear();
                    console.log(chalk.green('All caches cleared successfully!'));
                } else {
                    console.log(chalk.yellow('Cache clearing cancelled.'));
                }
            } else {
                this.cacheService.clear(key);
                console.log(chalk.green(`Cache for ${cacheType} cleared successfully!`));
            }
        } else {
            const { confirmClearAll } = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirmClearAll',
                message: 'Are you sure you want to clear ALL caches?',
                default: false
            }]);

            if (confirmClearAll) {
                this.cacheService.clear();
                console.log(chalk.green('All caches cleared successfully!'));
            } else {
                console.log(chalk.yellow('Cache clearing cancelled.'));
            }
        }
    }

    private getCacheKey(cacheType: string): string | null {
        switch (cacheType.toLowerCase()) {
            case 'users':
                return 'jira_users'; // Note: searchUsers uses dynamic keys, this clears all user-related caches
            case 'statuses':
                return 'jira_statuses';
            case 'projects':
                return 'jira_projects';
            case 'all':
                return null; // Null means clear all in CacheService
            default:
                return null;
        }
    }
}