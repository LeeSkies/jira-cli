export declare class GitService {
    isGitRepo(): Promise<boolean>;
    getCurrentBranch(): Promise<string>;
    branchExists(branchName: string): Promise<boolean>;
    createBranch(branchName: string): Promise<void>;
    switchToBranch(branchName: string): Promise<void>;
    deleteBranch(branchName: string): Promise<void>;
    mergeBranch(sourceBranch: string, targetBranch: string): Promise<void>;
}
