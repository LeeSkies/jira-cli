import { JiraTask } from '../types';
export declare class TasksCommand {
    private jiraService;
    private gitService;
    constructor();
    private setupKeyboardShortcuts;
    showTaskDetails(task: JiraTask): Promise<void>;
    confirmDelete(task: JiraTask): Promise<boolean>;
    assignTask(task: JiraTask): Promise<'back' | void>;
    showTaskActions(task: JiraTask): Promise<'back' | void>;
    getAvailableStatuses(): Promise<string[]>;
    search(query: string): Promise<void>;
    displayAndHandleTasks(tasks: JiraTask[]): Promise<void>;
    execute(taskId?: string, options?: any): Promise<void>;
    getTask(taskId: string): Promise<JiraTask | null>;
    getAvailableTransitions(taskId: string): Promise<JiraTask['transitions']>;
    changeStatus(taskId: string, transitionId: string): Promise<void>;
    view(task: JiraTask): Promise<'back' | void>;
    update(task: JiraTask): Promise<'back' | void>;
    addComment(task: JiraTask): Promise<'back' | void>;
    changeTaskStatus(task: JiraTask): Promise<'back' | void>;
    commitChanges(task: JiraTask): Promise<'back' | void>;
}
