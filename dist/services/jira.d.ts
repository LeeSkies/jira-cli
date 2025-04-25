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
    saveConfig(config: JiraConfig): void;
}
