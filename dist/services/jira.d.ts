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
    getTaskUrl(taskKey: string): string;
    openInBrowser(taskKey: string): Promise<void>;
    saveConfig(config: JiraConfig): void;
    searchTasks(query: string): Promise<JiraTask[]>;
    getTasksByStatus(status: string): Promise<JiraTask[]>;
    getAllTasks(): Promise<JiraTask[]>;
    getAvailableStatuses(): Promise<string[]>;
    getAvailableTransitions(taskId: string): Promise<JiraTask['transitions']>;
    searchUsers(query: string, projectKey?: string): Promise<any[]>;
    assignTask(taskId: string, accountId: string): Promise<void>;
}
