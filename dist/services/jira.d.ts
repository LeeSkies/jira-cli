import { JiraConfig, JiraTask } from '../types';
export declare class JiraService {
    private config;
    constructor();
    private fetchFromJira;
    getTask(taskId: string): Promise<JiraTask | null>;
    getTasks(): Promise<JiraTask[]>;
    updateTask(taskId: string, updates: {
        summary?: string;
        description?: string;
    }): Promise<void>;
    createSubtask(parentId: string, summary: string, description: string): Promise<any>;
    deleteTask(taskId: string): Promise<void>;
    addComment(taskId: string, comment: string): Promise<void>;
    changeStatus(taskId: string, transitionId: string): Promise<void>;
    private openUrl;
    getTaskUrl(taskKey: string): string;
    openInBrowser(taskKey: string): Promise<void>;
    saveConfig(config: JiraConfig): void;
    getConfig(): JiraConfig | undefined;
    searchTasks(query: string, exclude?: string): Promise<JiraTask[]>;
    getTasksByStatus(status: string): Promise<JiraTask[]>;
    getTasksByAssignee(accountId: string): Promise<JiraTask[]>;
    getTasksByFilters(assigneeId?: string, status?: string): Promise<JiraTask[]>;
    getAvailableStatuses(): Promise<string[]>;
    getAvailableTransitions(taskId: string): Promise<JiraTask['transitions']>;
    searchUsers(query: string, projectKey?: string): Promise<any[]>;
    assignTask(taskId: string, accountId: string): Promise<void>;
    getProjects(): Promise<any[]>;
}
