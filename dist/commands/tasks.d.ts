import { JiraTask } from '../types';
export declare class TasksCommand {
    private jiraService;
    private gitService;
    private githubService;
    constructor();
    private setupKeyboardShortcuts;
    private promptAfterAction;
    private validateCommitMessage;
    showTaskDetails(task: JiraTask): Promise<void>;
    confirmDelete(task: JiraTask): Promise<boolean>;
    assignTask(task: JiraTask): Promise<'back' | void>;
    showTaskActions(task: JiraTask): Promise<'back' | void>;
    getAvailableStatuses(): Promise<string[]>;
    search(query: string, exclude?: string): Promise<void>;
    displayAndHandleTasks(tasks: JiraTask[]): Promise<void>;
    execute(taskId?: string, options?: any): Promise<void>;
    getTask(taskId: string): Promise<JiraTask | null>;
    getAvailableTransitions(taskId: string): Promise<JiraTask['transitions']>;
    createSubtask(parentId: string, summary: string, description: string): Promise<void>;
    changeStatus(taskId: string, transitionId: string): Promise<void>;
    view(task: JiraTask): Promise<'back' | void>;
    update(task: JiraTask): Promise<'back' | void>;
    addComment(task: JiraTask): Promise<'back' | void>;
    changeTaskStatus(task: JiraTask): Promise<'back' | void>;
    commitChanges(task: JiraTask): Promise<'back' | void>;
    createPullRequest(task: JiraTask): Promise<'back' | void>;
}
