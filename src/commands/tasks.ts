import inquirer from 'inquirer';
import chalk from 'chalk';
import { JiraService } from '../services/jira';
import { GitService } from '../services/git';
import { JiraTask } from '../types';

export class TasksCommand {
    private jiraService: JiraService;
    private gitService: GitService;

    constructor() {
        this.jiraService = new JiraService();
        this.gitService = new GitService();
    }

    async showTaskDetails(task: JiraTask) {
        console.log(chalk.blue('\nTask Details:'));
        console.log(chalk.white(`ID: ${task.key}`));
        console.log(chalk.white(`Summary: ${task.fields.summary}`));
        console.log(chalk.white(`Description: ${task.fields.description || 'No description'}`));
        if (task.fields.subtasks.length > 0) {
            console.log(chalk.blue('\nSubtasks:'));
            for (const subtask of task.fields.subtasks) {
                console.log(chalk.white(`- ${subtask.key}: ${subtask.fields.summary}`));
            }
        }
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

    async createSubtaskBranchName(task: JiraTask): Promise<string> {
        const { type, details } = await inquirer.prompt([
            {
                type: 'list',
                name: 'type',
                message: 'Select the branch type:',
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
                ]
            },
            {
                type: 'input',
                name: 'details',
                message: 'Enter additional details (optional):',
                validate: (input: string) => {
                    if (input && !/^[a-zA-Z0-9-_]*$/.test(input)) {
                        return 'Details can only contain letters, numbers, dashes, and underscores';
                    }
                    return true;
                }
            }
        ]);

        return details ? `${type}/${task.key}/${details}` : `${type}/${task.key}`;
    }

    async showTaskActions(task: JiraTask) {
        const isGitAvailable = await this.gitService.isGitRepo();
        const isSubtask = task.fields.issuetype.name === 'Subtask' || task.fields.issuetype?.subtask === true;
        
        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'Select an action:',
            choices: [
                { name: 'View Details', value: 'view' },
                { name: 'Update', value: 'update' },
                { 
                    name: `Add Subtask${isSubtask ? ' (not available)' : ''}`,
                    value: 'subtask',
                    disabled: isSubtask
                },
                { name: chalk.red('Delete'), value: 'delete' },
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
                    name: chalk.red('Delete Branch'),
                    value: 'delete-branch',
                    disabled: !isGitAvailable
                }
            ]
        }]);

        switch (action) {
            case 'view':
                await this.showTaskDetails(task);
                break;

            case 'update':
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
                break;

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
                    const branchName = isSubtask ? await this.createSubtaskBranchName(task) : task.key;
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
                    const branchName = isSubtask ? await this.createSubtaskBranchName(task) : task.key;
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
                    const branchName = isSubtask ? await this.createSubtaskBranchName(task) : task.key;
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
                const tasks = await this.jiraService.getTasks();
                if (tasks.length === 0) {
                    console.log(chalk.yellow('No tasks found.'));
                    return;
                }

                const { selectedTask } = await inquirer.prompt([{
                    type: 'list',
                    name: 'selectedTask',
                    message: 'Select a task:',
                    choices: tasks.map(t => ({
                        name: `${t.key}: ${t.fields.summary}${t.fields.issuetype.name === 'Subtask' ? chalk.yellow(' [Subtask]') : ''}`,
                        value: t
                    }))
                }]);

                await this.showTaskActions(selectedTask);
            }
        } catch (error: any) {
            console.error(chalk.red(`Error: ${error.message}`));
        }
    }
}