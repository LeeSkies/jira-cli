import { JiraTask } from '../types';
export declare class TasksCommand {
    private jiraService;
    private gitService;
    constructor();
    showTaskDetails(task: JiraTask): Promise<void>;
    confirmDelete(task: JiraTask): Promise<boolean>;
    showTaskActions(task: JiraTask): Promise<'back' | void>;
    execute(taskId?: string, options?: any): Promise<void>;
}
