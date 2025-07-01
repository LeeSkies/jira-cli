import inquirer from 'inquirer';
import chalk from 'chalk';
import { JiraService } from '../services/jira';
import { GitService } from '../services/git';
import { GithubService } from '../services/github';
import { JiraTask } from '../types';

export class TasksCommand {
    private jiraService: JiraService;
    private gitService: GitService;
    private githubService: GithubService;

    constructor() {
        this.jiraService = new JiraService();
        this.gitService = new GitService();
        this.githubService = new GithubService();
    }

    private setupKeyboardShortcuts(callback: () => void) {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        
        const handler = (key: Buffer) => {
            // Ctrl+B is represented as \x02 in raw mode
            if (key.toString() === '\x02') {
                process.stdin.removeListener('data', handler);
                if (process.stdin.isTTY) {
                    process.stdin.setRawMode(false);
                }
                console.log(chalk.yellow('\nOperation cancelled'));
                callback();
            }
        };
        
        process.stdin.addListener('data', handler);
        return () => {
            process.stdin.removeListener('data', handler);
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(false);
            }
        };
    }

    private async promptAfterAction(task: JiraTask): Promise<'view-again' | 'back'> {
        const { nextAction } = await inquirer.prompt([{
            type: 'list',
            name: 'nextAction',
            message: 'What next?',
            choices: [
                { name: 'View task again', value: 'view-again' },
                { name: 'Back to tasks list', value: 'back' }
            ],
            loop: false
        }]);
        return nextAction;
    }

    private validateCommitMessage(message: string, taskKey: string): boolean {
        const regex = new RegExp(`^\\[(fix|feat|build|chore|ci|docs|style|refactor|perf|test)\\] ${taskKey}( \\| .*)?$`);
        return regex.test(message);
    }

    async showTaskDetails(task: JiraTask) {
        console.log(chalk.blue('\n=== Task Details ==='));
        console.log(`${chalk.blue('ID:')} ${task.key}`);
        console.log(`${chalk.blue('Type:')} ${task.fields.issuetype.name}`);
        console.log(`${chalk.blue('Status:')} ${task.fields.status.name}`);
        console.log(`${chalk.blue('Summary:')} ${task.fields.summary}`);
        console.log(`${chalk.blue('Description:')} ${task.fields.description || 'No description'}`);

        if (task.fields.parent) {
            console.log(chalk.blue('\nParent Task:'));
            console.log(`  ${chalk.blue('Key:')} ${task.fields.parent.key}`);
            console.log(`  ${chalk.blue('Summary:')} ${task.fields.parent.fields.summary}`);
        }

        const attachments = task.fields.attachment;
        if (attachments?.total && attachments.total > 0) {
            console.log(chalk.blue('\nAttachments:'));
            console.log(`  ${chalk.blue('Total:')} ${attachments.total}`);
        }

        if (task.fields.subtasks.length > 0) {
            console.log(chalk.blue('\nSubtasks:'));
            for (const subtask of task.fields.subtasks) {
                console.log(`  - ${chalk.blue('Key:')} ${subtask.key}`);
                console.log(`    ${chalk.blue('Summary:')} ${subtask.fields.summary}`);
            }
        }

        const sprint = task.fields.customfield_10020?.[0];
        if (sprint) {
            console.log(chalk.blue('\nSprint:'));
            console.log(`  ${chalk.blue('Name:')} ${sprint.name}`);
            console.log(`  ${chalk.blue('State:')} ${sprint.state}`);
        }

        const comments = task.fields.comment?.comments ?? [];
        if (comments.length > 0) {
            console.log(chalk.blue('\nComments:'));
            for (const comment of comments) {
                console.log(`\n  ${chalk.blue('Author:')} ${comment.author.displayName}`);
                console.log(`  ${chalk.blue('Date:')} ${new Date(comment.created).toLocaleString()}`);
                console.log(`  ${chalk.blue('Content:')} ${comment.body}`);
            }
        }

        console.log(chalk.blue('\n==================\n'));
    }

    async confirmDelete(task: JiraTask): Promise<boolean> {
        console.log(chalk.red('\n=== DELETE TASK ==='));
        console.log(chalk.red('Task to delete:'));
        console.log(chalk.red(`ID: ${task.key}`));
        console.log(chalk.red(`Type: ${task.fields.issuetype.name}`));
        console.log(chalk.red(`Summary: ${task.fields.summary}`));
        console.log(chalk.red(`Description: ${task.fields.description || 'No description'}`));
        console.log(chalk.red('==================\n'));

        const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: chalk.red('⚠️  Are you sure you want to delete this task? This action cannot be undone.'),
            default: false
        }]);

        return confirm;
    }

    async assignTask(task: JiraTask): Promise<'back' | void> {
        const cleanup = this.setupKeyboardShortcuts(() => this.showTaskActions(task));
        
        try {
            console.log(chalk.blue('\nPress Ctrl+B at any time to cancel and return to task actions\n'));
            
            // Extract project key from task key (e.g., "PROJ-123" -> "PROJ")
            const projectKey = task.key.split('-')[0];
            
            // Get all users without requiring a search
            console.log(chalk.yellow('\nFetching users...'));
            const users = await this.jiraService.searchUsers('', projectKey);
            if (users.length === 0) {
                console.log(chalk.yellow('\nNo users found'));
                cleanup();
                return;
            }

            const { selectedUser } = await inquirer.prompt([{
                type: 'list',
                name: 'selectedUser',
                message: 'Select user to assign:',
                choices: users.map(u => ({
                    name: u.displayName,
                    value: u.accountId
                })),
                loop: false
            }]);

            await this.jiraService.assignTask(task.key, selectedUser);
        } finally {
            cleanup();
        }
    }

    async showTaskActions(task: JiraTask): Promise<'back' | void> {
        const isGitAvailable = await this.gitService.isGitRepo();
        const isSubtask = task.fields.issuetype.name === 'Subtask' || task.fields.issuetype?.subtask === true;
        
        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'Select an action:',
            pageSize: 50,  // Show all options without scrolling
            loop: false,   // Don't wrap around
            choices: [
                { name: 'View Details', value: 'view' },
                { name: 'Change Status', value: 'change-status' },
                { name: 'Update', value: 'update' },
                { name: 'Assign', value: 'assign' },
                { name: 'Add Comment', value: 'comment' },
                { 
                    name: `Add Subtask${isSubtask ? ' (not available)' : ''}`,
                    value: 'subtask',
                    disabled: isSubtask
                },
                { name: 'Open in Browser', value: 'open-browser' },
                { 
                    name: 'Create Branch',
                    value: 'create-branch',
                    disabled: !isGitAvailable
                },
                { 
                    name: 'Go to Branch',
                    value: 'goto-branch',
                    disabled: !isGitAvailable
                },
                {
                    name: 'Commit Changes',
                    value: 'commit',
                    disabled: !isGitAvailable
                },
                {
                    name: 'Create Pull Request',
                    value: 'create-pr',
                    disabled: !isGitAvailable
                },
                { 
                    name: chalk.red('Delete Branch'),
                    value: 'delete-branch',
                    disabled: !isGitAvailable
                },
                { name: chalk.red('Delete'), value: 'delete' },
                { name: 'Back to Tasks List', value: 'back' }
            ]
        }]);

        switch (action) {
            case 'back':
                return 'back';

            case 'view':
                return this.view(task);

            case 'update':
                return this.update(task);

            case 'assign':
                return this.assignTask(task);

            case 'comment':
                return this.addComment(task);

            case 'change-status':
                return this.changeTaskStatus(task);

            case 'commit':
                await this.commitChanges(task);
                return await this.promptAfterAction(task) === 'view-again' ? this.showTaskActions(task) : 'back';

            case 'create-pr':
                await this.createPullRequest(task);
                return await this.promptAfterAction(task) === 'view-again' ? this.showTaskActions(task) : 'back';

            case 'subtask':
                if (isSubtask) {
                    console.log(chalk.red('Cannot create subtasks for a subtask'));
                    return;
                }
                const subtaskDetails = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'summary',
                        message: 'Enter subtask summary:'
                    },
                    {
                        type: 'input',
                        name: 'description',
                        message: 'Enter subtask description:'
                    }
                ]);
                await this.jiraService.createSubtask(task.key, subtaskDetails.summary, subtaskDetails.description);
                break;

            case 'delete':
                if (await this.confirmDelete(task)) {
                    await this.jiraService.deleteTask(task.key);
                }
                break;

            case 'create-branch':
                try {
                    const branchName = task.key;
                    if (await this.gitService.branchExists(branchName)) {
                        console.log(chalk.yellow(`Branch '${branchName}' already exists.`));
                        return;
                    }
                    await this.gitService.createBranch(branchName);
                    console.log(chalk.green(`Created and switched to branch '${branchName}'`));
                } catch (error: any) {
                    console.error(chalk.red(`Error creating branch: ${error.message}`));
                }
                break;

            case 'goto-branch':
                try {
                    const branchName = task.key;
                    if (!await this.gitService.branchExists(branchName)) {
                        console.log(chalk.yellow(`Branch '${branchName}' does not exist.`));
                        return;
                    }
                    const currentBranch = await this.gitService.getCurrentBranch();
                    if (currentBranch === branchName) {
                        console.log(chalk.yellow(`Already on branch '${branchName}'`));
                        return;
                    }
                    await this.gitService.switchToBranch(branchName);
                    console.log(chalk.green(`Switched to branch '${branchName}'`));
                } catch (error: any) {
                    console.error(chalk.red(`Error switching branch: ${error.message}`));
                }
                break;

            case 'delete-branch':
                try {
                    const branchName = task.key;
                    if (!await this.gitService.branchExists(branchName)) {
                        console.log(chalk.yellow(`Branch '${branchName}' does not exist.`));
                        return;
                    }
                    
                    const currentBranch = await this.gitService.getCurrentBranch();
                    if (currentBranch === branchName) {
                        console.log(chalk.red(`Cannot delete the current branch '${branchName}'`));
                        return;
                    }

                    const { confirm } = await inquirer.prompt([{
                        type: 'confirm',
                        name: 'confirm',
                        message: chalk.red(`Are you sure you want to delete branch '${branchName}'?`),
                        default: false
                    }]);

                    if (confirm) {
                        await this.gitService.deleteBranch(branchName);
                        console.log(chalk.green(`Branch '${branchName}' deleted successfully`));
                    }
                } catch (error: any) {
                    console.error(chalk.red(`Error deleting branch: ${error.message}`));
                }
                break;

            case 'open-browser':
                await this.jiraService.openInBrowser(task.key);
                break;
        }
    }

    async getAvailableStatuses(): Promise<string[]> {
        return this.jiraService.getAvailableStatuses();
    }

    async search(query: string, exclude?: string): Promise<void> {
        const tasks = await this.jiraService.searchTasks(query, exclude);
        await this.displayAndHandleTasks(tasks);
    }

    async displayAndHandleTasks(tasks: JiraTask[]): Promise<void> {
        if (tasks.length === 0) {
            console.log(chalk.yellow('No tasks found.'));
            return;
        }

        let shouldShowTasks = true;
        while (shouldShowTasks) {
            const { selectedTask } = await inquirer.prompt([{
                type: 'list',
                name: 'selectedTask',
                message: 'Select a task:',
                pageSize: 50,  // Show all options without scrolling
                loop: false,   // Don't wrap around
                choices: tasks.map(t => {
                    let name = `${t.key}: ${t.fields.summary}`;
                    
                    // Add colored status
                    const status = t.fields.status.name;
                    let statusColor;
                    switch(status.toLowerCase()) {
                        case 'to do':
                            statusColor = chalk.yellow;
                            break;
                        case 'in progress':
                            statusColor = chalk.blue;
                            break;
                        case 'done':
                            statusColor = chalk.green;
                            break;
                        default:
                            statusColor = chalk.white;
                    }
                    name += ` ${statusColor(`[${status}]`)}`;
                    
                    // Add subtask indicator and count if any
                    if (t.fields.subtasks.length > 0) {
                        name += chalk.blue(` [${t.fields.subtasks.length} subtasks]`);
                    }
                    
                    // Add subtask indicator and parent info
                    if (t.fields.issuetype.name === 'Subtask') {
                        name += chalk.yellow(' [Subtask]');
                        if (t.fields.parent) {
                            name += chalk.cyan(` → ${t.fields.parent.key}`);
                        }
                    }

                    return {
                        name,
                        value: t
                    };
                })
            }]);

            const result = await this.showTaskActions(selectedTask);
            if (result !== 'back') {
                shouldShowTasks = false;
            }
        }
    }

    async execute(taskId?: string, options: any = {}) {
        try {
            if (taskId) {
                const task = await this.jiraService.getTask(taskId);
                if (!task) {
                    console.log(chalk.red('Task not found!'));
                    return;
                }

                if (options.update) {
                    const { summary, description } = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'summary',
                            message: 'Enter new summary:',
                            default: task.fields.summary
                        },
                        {
                            type: 'input',
                            name: 'description',
                            message: 'Enter new description:',
                            default: task.fields.description
                        }
                    ]);
                    await this.jiraService.updateTask(taskId, { summary, description });
                } else if (options.subtask) {
                    const { summary, description } = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'summary',
                            message: 'Enter subtask summary:'
                        },
                        {
                            type: 'input',
                            name: 'description',
                            message: 'Enter subtask description:'
                        }
                    ]);
                    await this.jiraService.createSubtask(taskId, summary, description);
                } else if (options.delete) {
                    if (await this.confirmDelete(task)) {
                        await this.jiraService.deleteTask(taskId);
                    }
                } else {
                    await this.showTaskActions(task);
                }
            } else {
                let tasks;
                if (options.all) {
                    tasks = await this.jiraService.getTasksByFilters(undefined, undefined);
                } else if (options.status) {
                    tasks = await this.jiraService.getTasksByStatus(options.status);
                } else {
                    tasks = await this.jiraService.getTasks();
                }
                await this.displayAndHandleTasks(tasks);
            }
        } catch (error: any) {
            console.error(chalk.red(`Error: ${error.message}`));
        }
    }

    async getTask(taskId: string): Promise<JiraTask | null> {
        return this.jiraService.getTask(taskId);
    }

    async getAvailableTransitions(taskId: string): Promise<JiraTask['transitions']> {
        return this.jiraService.getAvailableTransitions(taskId);
    }

    async createSubtask(parentId: string, summary: string, description: string): Promise<void> {
        await this.jiraService.createSubtask(parentId, summary, description);
    }

    async changeStatus(taskId: string, transitionId: string): Promise<void> {
        return this.jiraService.changeStatus(taskId, transitionId);
    }

    async view(task: JiraTask): Promise<'back' | void> {
        const viewCleanup = this.setupKeyboardShortcuts(() => this.showTaskActions(task));
        await this.showTaskDetails(task);
        viewCleanup();
    }

    async update(task: JiraTask): Promise<'back' | void> {
        const updateCleanup = this.setupKeyboardShortcuts(() => this.showTaskActions(task));
        try {
            const { summary, description } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'summary',
                    message: 'Enter new summary:',
                    default: task.fields.summary
                },
                {
                    type: 'input',
                    name: 'description',
                    message: 'Enter new description:',
                    default: task.fields.description
                }
            ]);
            await this.jiraService.updateTask(task.key, { summary, description });
        } finally {
            updateCleanup();
        }
    }

    async addComment(task: JiraTask): Promise<'back' | void> {
        const commentCleanup = this.setupKeyboardShortcuts(() => this.showTaskActions(task));
        try {
            const { comment } = await inquirer.prompt([{
                type: 'input',
                name: 'comment',
                message: 'Enter your comment:',
                validate: (input) => input.length > 0 || 'Comment cannot be empty'
            }]);
            await this.jiraService.addComment(task.key, comment);
        } finally {
            commentCleanup();
        }
    }

    async changeTaskStatus(task: JiraTask): Promise<'back' | void> {
        const statusCleanup = this.setupKeyboardShortcuts(() => this.showTaskActions(task));
        try {
            const transitions = await this.jiraService.getAvailableTransitions(task.key);
            if (!transitions?.length) {
                console.log(chalk.yellow('No status transitions available'));
                return;
            }

            const { transitionId } = await inquirer.prompt([{
                type: 'list',
                name: 'transitionId',
                message: 'Select new status:',
                pageSize: 20,
                loop: false,
                choices: transitions.map(t => ({
                    name: `${t.to.name}${t.to.id === task.fields.status.id ? ' (current)' : ''}`,
                    value: t.id,
                    disabled: t.to.id === task.fields.status.id
                }))
            }]);
            await this.jiraService.changeStatus(task.key, transitionId);
        } finally {
            statusCleanup();
        }
    }

    async commitChanges(task: JiraTask): Promise<'back' | void> {
        const commitCleanup = this.setupKeyboardShortcuts(() => this.showTaskActions(task));
        try {
            const currentBranch = await this.gitService.getCurrentBranch();
            if (currentBranch !== task.key) {
                console.log(chalk.red(`Error: You are not on the task's branch (${task.key}). Current branch is ${currentBranch}.`));
                return;
            }

            const { type } = await inquirer.prompt([{
                type: 'list',
                name: 'type',
                message: 'Select commit type:',
                choices: [
                    'fix',
                    'feat',
                    'build',
                    'chore',
                    'ci',
                    'docs',
                    'style',
                    'refactor',
                    'perf',
                    'test'
                ],
                loop: false
            }]);

            const { details } = await inquirer.prompt([{
                type: 'input',
                name: 'details',
                message: 'Enter additional details (optional):',
                validate: (input: string) => {
                    if (input && !/^[a-zA-Z0-9-_ ]*$/.test(input)) {
                        return 'Details can only contain letters, numbers, spaces, dashes, and underscores';
                    }
                    return true;
                }
            }]);

            const commitMessage = details 
                ? `[${type}] ${task.key} | ${details}`
                : `[${type}] ${task.key}`;

            await this.gitService.commit(commitMessage);
            console.log(chalk.green(`Changes committed with message: ${commitMessage}`));
        } finally {
            commitCleanup();
        }
    }

    async createPullRequest(task: JiraTask): Promise<'back' | void> {
        const prCleanup = this.setupKeyboardShortcuts(() => this.showTaskActions(task));
        try {
            const currentBranch = await this.gitService.getCurrentBranch();
            if (currentBranch !== task.key) {
                console.log(chalk.red(`Error: You are not on the task's branch (${task.key}). Current branch is ${currentBranch}.`));
                return;
            }

            await this.gitService.push(currentBranch);

            const lastCommitMessage = await this.gitService.getLastCommitMessage();
            const defaultBranch = await this.gitService.getDefaultBranch();

            let prTitle = lastCommitMessage;
            const prBody = `Resolves [${task.key}](${this.jiraService.getTaskUrl(task.key)})`;

            if (!this.validateCommitMessage(lastCommitMessage, task.key)) {
                console.log(chalk.yellow(`
Warning: The last commit message does not follow the convention:`));
                console.log(chalk.yellow(`  Expected: [type] ${task.key} | optional_details`));
                console.log(chalk.yellow(`  Found: ${lastCommitMessage}
`));

                const { confirmProceed } = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'confirmProceed',
                    message: 'Do you want to create the Pull Request anyway?',
                    default: false
                }]);

                if (!confirmProceed) {
                    console.log(chalk.yellow('Pull Request creation cancelled.'));
                    return;
                }
            }

            console.log(chalk.blue('--- Pull Request Details ---'));
            console.log(`${chalk.blue('Title:')} ${prTitle}`);
            console.log(`${chalk.blue('Body:')} ${prBody}`);
            console.log(`${chalk.blue('Head Branch:')} ${currentBranch}`);
            console.log(`${chalk.blue('Base Branch:')} ${defaultBranch}`);
            console.log(chalk.blue('----------------------------'));

            const { confirmCreate } = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirmCreate',
                message: 'Do you want to create this Pull Request?',
                default: true
            }]);

            if (!confirmCreate) {
                console.log(chalk.yellow('Pull Request creation cancelled.'));
                return;
            }

            const pr = await this.githubService.createPullRequest(
                currentBranch,
                prTitle,
                prBody,
                defaultBranch
            );

            console.log(chalk.green(`Successfully created pull request: ${pr.html_url}`))
        } catch (error: any) {
            console.error(chalk.red(`Error creating pull request: ${error.message}`));
        } finally {
            prCleanup();
        }
    }
}