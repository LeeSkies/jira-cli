export declare class GitService {
    isGitRepo(): Promise<boolean>;
    getCurrentBranch(): Promise<string>;
    branchExists(branchName: string): Promise<boolean>;
    createBranch(branchName: string): Promise<void>;
    switchToBranch(branchName: string): Promise<void>;
    deleteBranch(branchName: string): Promise<void>;
    mergeBranch(sourceBranch: string, targetBranch: string): Promise<void>;
    commit(message: string): Promise<void>;
    getRemoteUrl(): Promise<string>;
    getLastCommitMessage(): Promise<string>;
    getDefaultBranch(): Promise<string>;
    push(branchName: string): Promise<void>;
    listLocalBranches(): Promise<string[]>;
}
