import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitService {
    async isGitRepo(): Promise<boolean> {
        try {
            await execAsync('git rev-parse --is-inside-work-tree');
            return true;
        } catch {
            return false;
        }
    }

    async getCurrentBranch(): Promise<string> {
        const { stdout } = await execAsync('git branch --show-current');
        return stdout.trim();
    }

    async branchExists(branchName: string): Promise<boolean> {
        try {
            const { stdout } = await execAsync(`git branch --list ${branchName}`);
            return stdout.trim() !== '';
        } catch {
            return false;
        }
    }

    async createBranch(branchName: string): Promise<void> {
        await execAsync(`git checkout -b ${branchName}`);
    }

    async switchToBranch(branchName: string): Promise<void> {
        await execAsync(`git checkout ${branchName}`);
    }

    async deleteBranch(branchName: string): Promise<void> {
        await execAsync(`git branch -D ${branchName}`);
    }

    async mergeBranch(sourceBranch: string, targetBranch: string): Promise<void> {
        const currentBranch = await this.getCurrentBranch();
        
        // Switch to target branch
        await this.switchToBranch(targetBranch);
        
        try {
            // Merge the source branch
            await execAsync(`git merge ${sourceBranch}`);
        } catch (error: any) {
            // If merge fails, try to abort and switch back
            try {
                await execAsync('git merge --abort');
            } finally {
                await this.switchToBranch(currentBranch);
                throw error;
            }
        }
        
        // Switch back to original branch if different
        if (currentBranch !== targetBranch) {
            await this.switchToBranch(currentBranch);
        }
    }

    async commit(message: string): Promise<void> {
        try {
            // First stage all changes
            await execAsync('git add .');
            // Then commit with the provided message
            await execAsync(`git commit -m "${message}"`);
        } catch (error: any) {
            throw new Error(`Failed to commit: ${error.message}`);
        }
    }

    async getRemoteUrl(): Promise<string> {
        const { stdout } = await execAsync('git config --get remote.origin.url');
        return stdout.trim();
    }

    async getLastCommitMessage(): Promise<string> {
        const { stdout } = await execAsync('git log -1 --pretty=%B');
        return stdout.trim();
    }

    async getDefaultBranch(): Promise<string> {
        try {
            const { stdout } = await execAsync('git symbolic-ref refs/remotes/origin/HEAD');
            return stdout.trim().split('/').pop() || 'main';
        } catch {
            // Fallback for detached HEAD or other issues
            return 'main';
        }
    }

    async push(branchName: string): Promise<void> {
        await execAsync(`git push -u origin ${branchName}`);
    }
}