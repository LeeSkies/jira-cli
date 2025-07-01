export declare class GithubService {
    private config;
    private gitService;
    constructor();
    private getRepoOwnerAndName;
    createPullRequest(head: string, title: string, body: string, base: string): Promise<any>;
}
