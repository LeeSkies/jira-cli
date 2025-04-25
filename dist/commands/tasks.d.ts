import { JiraTask } from '../types';
export declare class TasksCommand {
    private jiraService;
    private gitService;
    constructor();
    showTaskDetails(task: JiraTask): Promise<void>;
    confirmDelete(task: JiraTask): Promise<boolean>;
    createSubtaskBranchName(task: JiraTask): Promise<string>;
    showTaskActions(task: JiraTask): Promise<void>;
    execute(taskId?: string, options?: any): Promise<void>;
}
