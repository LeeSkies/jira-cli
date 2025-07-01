import ConfigStore from 'configstore';
import { JiraConfig, JiraTask } from '../types';
import { GitService } from './git';
import chalk from 'chalk';

export class GithubService {
    private config: ConfigStore;
    private gitService: GitService;

    constructor() {
        this.config = new ConfigStore('jira-cli');
        this.gitService = new GitService();
    }

    private async getRepoOwnerAndName(): Promise<{ owner: string; name: string; }> {
        const remoteUrl = await this.gitService.getRemoteUrl();
        // Supports both SSH and HTTPS URLs
        const match = remoteUrl.match(/github\.com[\/\:]([\w\-]+)\/([\w\-]+)(\.git)?/);
        if (!match) {
            throw new Error(`Could not parse repository owner and name from remote URL: ${remoteUrl}`);
        }
        return { owner: match[1], name: match[2] };
    }

    async createPullRequest(head: string, title: string, body: string, base: string) {
        const jiraConfig = this.config.get('jiraConfig') as JiraConfig;
        if (!jiraConfig.githubToken) {
            throw new Error('GitHub token not found. Please run "jira config" to set it.');
        }

        const { owner, name } = await this.getRepoOwnerAndName();

        const response = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${jiraConfig.githubToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json',
            },
            body: JSON.stringify({
                title,
                head,
                base,
                body,
            }),
        });

        const responseJson = await response.json();

        if (!response.ok) {
            throw new Error(`GitHub API Error: ${responseJson.message} (${JSON.stringify(responseJson.errors)})`);
        }

        return responseJson;
    }
}
