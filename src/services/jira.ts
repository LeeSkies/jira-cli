import ConfigStore from 'configstore';
import { JiraConfig, JiraTask } from '../types';
import { CacheService } from './cache';
import chalk from 'chalk';
import { spawn, type ChildProcess, type SpawnOptions } from 'child_process';
import { platform } from 'os';

export class JiraService {
    private config: ConfigStore;
    private cacheService: CacheService;

    constructor() {
        this.config = new ConfigStore('jira-cli');
        const jiraConfig = this.config.get('jiraConfig') as JiraConfig;
        const cacheDurationDays = jiraConfig?.cacheDurationDays ?? 7;
        this.cacheService = new CacheService(cacheDurationDays);
    }

    private async fetchFromJira(path: string, options: RequestInit = {}) {
        const jiraConfig = this.config.get('jiraConfig') as JiraConfig;
        if (!jiraConfig) {
            throw new Error('JIRA configuration not found. Please run "jira config" first.');
        }

        const { email, apiKey, baseUrl } = jiraConfig;
        const auth = Buffer.from(`${email}:${apiKey}`).toString('base64');

        const response = await fetch(`${baseUrl}/rest/api/2/${path}`, {
            ...options,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        const responseText = await response.text();
        if (!response.ok) {
            throw new Error(`JIRA API Error (${response.status}): ${responseText}`);
        }

        try {
            return responseText ? JSON.parse(responseText) : null;
        } catch (e) {
            throw new Error('Failed to parse JIRA response');
        }
    }

    async getTask(taskId: string): Promise<JiraTask | null> {
        try {
            return await this.fetchFromJira(
                `issue/${taskId}?fields=summary,description,subtasks,issuetype,status,comment,attachment,parent,customfield_10020&expand=transitions`
            );
        } catch (error: any) {
            console.error(chalk.red(`Error fetching task: ${error.message}`));
            return null;
        }
    }

    async getTasks(): Promise<JiraTask[]> {
        try {
            const result = await this.fetchFromJira('search', {
                method: 'POST',
                body: JSON.stringify({
                    jql: 'assignee = currentUser() ORDER BY updated DESC',
                    fields: ['summary', 'description', 'subtasks', 'issuetype', 'status', 'parent', 'customfield_10020'],
                    expand: ['transitions']
                })
            });
            return result.issues;
        } catch (error: any) {
            console.error(chalk.red(`Error fetching tasks: ${error.message}`));
            return [];
        }
    }

    async updateTask(taskId: string, updates: { summary?: string; description?: string }) {
        try {
            await this.fetchFromJira(`issue/${taskId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    fields: {
                        summary: updates.summary,
                        description: updates.description
                    }
                })
            });
            console.log(chalk.green('Task updated successfully!'));
        } catch (error: any) {
            console.error(chalk.red(`Error updating task: ${error.message}`));
        }
    }

    async createSubtask(parentId: string, summary: string, description: string) {
        try {
            const projectKey = parentId.split('-')[0];
            
            const metadata = await this.fetchFromJira(`issue/createmeta?projectKeys=${projectKey}&expand=projects.issuetypes`);
            const project = metadata.projects[0];
            const subtaskType = project.issuetypes.find((type: any) => type.subtask === true);

            if (!subtaskType) {
                throw new Error('Subtask type not found in project');
            }

            const result = await this.fetchFromJira('issue', {
                method: 'POST',
                body: JSON.stringify({
                    fields: {
                        project: { key: projectKey },
                        summary,
                        description,
                        issuetype: { id: subtaskType.id },
                        parent: { key: parentId }
                    }
                })
            });
            console.log(chalk.green('Subtask created successfully!'));
            return result;
        } catch (error: any) {
            console.error(chalk.red(`Error creating subtask: ${error.message}`));
            return null;
        }
    }

    async deleteTask(taskId: string) {
        try {
            await this.fetchFromJira(`issue/${taskId}`, {
                method: 'DELETE'
            });
            console.log(chalk.green('Task deleted successfully!'));
        } catch (error: any) {
            console.error(chalk.red(`Error deleting task: ${error.message}`));
        }
    }

    async addComment(taskId: string, comment: string) {
        try {
            await this.fetchFromJira(`issue/${taskId}/comment`, {
                method: 'POST',
                body: JSON.stringify({ body: comment })
            });
            console.log(chalk.green('Comment added successfully!'));
        } catch (error: any) {
            console.error(chalk.red(`Error adding comment: ${error.message}`));
        }
    }

    async changeStatus(taskId: string, transitionId: string) {
        try {
            await this.fetchFromJira(`issue/${taskId}/transitions`, {
                method: 'POST',
                body: JSON.stringify({
                    transition: { id: transitionId }
                })
            });
            console.log(chalk.green('Status updated successfully!'));
        } catch (error: any) {
            console.error(chalk.red(`Error changing status: ${error.message}`));
        }
    }

    private openUrl(url: string): void {
        const isWin = platform() === 'win32';
        const isMac = platform() === 'darwin';
        
        // Detach the process so it runs independently
        const options: SpawnOptions = {
            detached: true,
            stdio: ['ignore', 'ignore', 'ignore']
        };

        let cmd: string;
        let args: string[];

        if (isWin) {
            // Escape the URL for Windows command line
            const escapedUrl = `"${url.replace(/"/g, '""')}"`;
            cmd = 'cmd.exe';
            args = ['/c', 'start', '', escapedUrl];  // Empty string as title parameter
        } else if (isMac) {
            cmd = 'open';
            args = [url];
        } else {
            // Linux - try x-www-browser first
            cmd = 'x-www-browser';
            args = [url];
        }

        const child = spawn(cmd, args, options) as ChildProcess;
        child.unref(); // Let the process run independently

        // If first attempt fails on Linux, try alternative browsers
        if (!isWin && !isMac) {
            child.on('error', () => {
                const browsers = [
                    'firefox',
                    'google-chrome',
                    'chromium',
                    'chromium-browser',
                    'brave-browser',
                    'opera'
                ];

                // Try each browser in sequence until one works
                for (const browser of browsers) {
                    const altChild = spawn(browser, [url], options) as ChildProcess;
                    altChild.unref();
                    
                    // Break on first successful spawn
                    altChild.on('error', () => {});
                    altChild.on('spawn', () => {
                        return; // Exit the loop on first successful spawn
                    });
                }
            });
        }
    }

    getTaskUrl(taskKey: string): string {
        const jiraConfig = this.config.get('jiraConfig') as JiraConfig;
        return `${jiraConfig.baseUrl}/browse/${taskKey}`;
    }

    async openInBrowser(taskKey: string) {
        try {
            const url = this.getTaskUrl(taskKey);
            this.openUrl(url);
            console.log(chalk.green(`Opening ${taskKey} in your browser`));
        } catch (error: any) {
            console.error(chalk.red(`Error opening task in browser: ${error.message}`));
        }
    }

    saveConfig(config: JiraConfig) {
        this.config.set('jiraConfig', config);
    }

    getConfig(): JiraConfig | undefined {
        return this.config.get('jiraConfig');
    }

    async searchTasks(query: string, exclude?: string): Promise<JiraTask[]> {
        try {
            let jql = `summary ~ "${query}"`;
            if (exclude) {
                jql += ` AND summary !~ "${exclude}"`;
            }
            jql += ` ORDER BY updated DESC`;

            const result = await this.fetchFromJira('search', {
                method: 'POST',
                body: JSON.stringify({
                    jql,
                    fields: ['summary', 'description', 'subtasks', 'issuetype', 'status', 'parent', 'customfield_10020']
                })
            });
            return result.issues;
        } catch (error: any) {
            console.error(chalk.red(`Error searching tasks: ${error.message}`));
            return [];
        }
    }

    async getTasksByStatus(status: string): Promise<JiraTask[]> {
        try {
            const result = await this.fetchFromJira('search', {
                method: 'POST',
                body: JSON.stringify({
                    jql: `status = "${status}" ORDER BY updated DESC`,
                    fields: ['summary', 'description', 'subtasks', 'issuetype', 'status', 'parent', 'customfield_10020']
                })
            });
            return result.issues;
        } catch (error: any) {
            console.error(chalk.red(`Error fetching tasks by status: ${error.message}`));
            return [];
        }
    }

    async getTasksByAssignee(accountId: string): Promise<JiraTask[]> {
        try {
            const result = await this.fetchFromJira('search', {
                method: 'POST',
                body: JSON.stringify({
                    jql: `assignee = "${accountId}" ORDER BY updated DESC`,
                    fields: ['summary', 'description', 'subtasks', 'issuetype', 'status', 'parent', 'customfield_10020']
                })
            });
            return result.issues;
        } catch (error: any) {
            console.error(chalk.red(`Error fetching tasks by assignee: ${error.message}`));
            return [];
        }
    }

    async getTasksByFilters(assigneeId?: string, status?: string): Promise<JiraTask[]> {
        try {
            let jql = '';
            const conditions = [];

            if (assigneeId) {
                conditions.push(`assignee = "${assigneeId}"`);
            }

            if (status) {
                conditions.push(`status = "${status}"`);
            }

            if (conditions.length > 0) {
                jql = conditions.join(' AND ') + ' ORDER BY updated DESC';
            } else {
                jql = 'ORDER BY updated DESC'; // Default to all tasks if no filters
            }

            const result = await this.fetchFromJira('search', {
                method: 'POST',
                body: JSON.stringify({
                    jql,
                    fields: ['summary', 'description', 'subtasks', 'issuetype', 'status', 'parent', 'customfield_10020']
                })
            });
            return result.issues;
        } catch (error: any) {
            console.error(chalk.red(`Error fetching tasks by filters: ${error.message}`));
            return [];
        }
    }

    async getAvailableStatuses(): Promise<string[]> {
        const cacheKey = 'jira_statuses';
        const cachedStatuses = this.cacheService.get<string[]>(cacheKey);
        if (cachedStatuses) {
            return cachedStatuses;
        }

        try {
            const result = await this.fetchFromJira('status');
            const fetchedStatuses = result.map((status: any) => status.name);
            this.cacheService.set(cacheKey, fetchedStatuses);
            return fetchedStatuses;
        } catch (error: any) {
            console.error(chalk.red(`Error fetching statuses: ${error.message}`));
            return ['To Do', 'In Progress', 'Done']; // Fallback to default statuses
        }
    }

    async getAvailableTransitions(taskId: string): Promise<JiraTask['transitions']> {
        try {
            const result = await this.fetchFromJira(`issue/${taskId}/transitions`);
            return result.transitions;
        } catch (error: any) {
            console.error(chalk.red(`Error fetching transitions: ${error.message}`));
            return [];
        }
    }

    async searchUsers(query: string, projectKey?: string): Promise<any[]> {
        const cacheKey = `jira_users_${projectKey || 'no_project'}_${query || 'all'}`;
        const cachedUsers = this.cacheService.get<any[]>(cacheKey);
        if (cachedUsers) {
            return cachedUsers;
        }

        try {
            const jiraConfig = this.config.get('jiraConfig') as JiraConfig;
            const defaultProjectKey = jiraConfig?.defaultProjectKey;

            const queryParams = new URLSearchParams({
                maxResults: '1000'  // Get a large number of users
            });
            
            let effectiveProjectKey = projectKey || defaultProjectKey;

            if (effectiveProjectKey) {
                queryParams.append('project', effectiveProjectKey);
            }

            if (query) {
                queryParams.append('query', query);
            }

            const fetchedUsers = await this.fetchFromJira(`user/assignable/search?${queryParams.toString()}`);
            this.cacheService.set(cacheKey, fetchedUsers);
            return fetchedUsers;
        } catch (error: any) {
            console.error(chalk.red(`Error fetching users: ${error.message}`));
            return [];
        }
    }

    async assignTask(taskId: string, accountId: string) {
        try {
            await this.fetchFromJira(`issue/${taskId}/assignee`, {
                method: 'PUT',
                body: JSON.stringify({ accountId })
            });
            console.log(chalk.green('Task assigned successfully!'));
        } catch (error: any) {
            console.error(chalk.red(`Error assigning task: ${error.message}`));
        }
    }

    async getProjects(): Promise<any[]> {
        const cacheKey = 'jira_projects';
        const cachedProjects = this.cacheService.get<any[]>(cacheKey);
        if (cachedProjects) {
            return cachedProjects;
        }

        try {
            const result = await this.fetchFromJira('project');
            const fetchedProjects = result;
            this.cacheService.set(cacheKey, fetchedProjects);
            return fetchedProjects;
        } catch (error: any) {
            console.error(chalk.red(`Error fetching projects: ${error.message}`));
            return [];
        }
    }
}