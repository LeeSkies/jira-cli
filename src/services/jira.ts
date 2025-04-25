import ConfigStore from 'configstore';
import { JiraConfig, JiraTask } from '../types';
import chalk from 'chalk';

export class JiraService {
    private config: ConfigStore;

    constructor() {
        this.config = new ConfigStore('jira-cli');
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
            return await this.fetchFromJira(`issue/${taskId}?fields=summary,description,subtasks,issuetype`);
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
                    fields: ['summary', 'description', 'subtasks', 'issuetype']
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

    saveConfig(config: JiraConfig) {
        this.config.set('jiraConfig', config);
    }
}