#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import ConfigStore from 'configstore';
import chalk from 'chalk';

interface JiraConfig {
    email: string;
    apiKey: string;
    baseUrl: string;
}

interface JiraTask {
    id: string;
    key: string;
    fields: {
        summary: string;
        description: string;
        subtasks: JiraTask[];
        issuetype: {
            id: string;
            name: string;
            subtask: boolean;
        };
    };
}

const config = new ConfigStore('jira-cli');
const program = new Command();

async function fetchFromJira(path: string, options: RequestInit = {}) {
    const jiraConfig = config.get('jiraConfig') as JiraConfig;
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

async function getTask(taskId: string): Promise<JiraTask | null> {
    try {
        const task = await fetchFromJira(`issue/${taskId}?fields=summary,description,subtasks,issuetype`);
        return task;
    } catch (error: any) {
        console.error(chalk.red(`Error fetching task: ${error.message}`));
        return null;
    }
}

async function getTasks(): Promise<JiraTask[]> {
    try {
        const result = await fetchFromJira('search', {
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

async function updateJiraTask(taskId: string, updates: { summary?: string; description?: string }) {
    try {
        await fetchFromJira(`issue/${taskId}`, {
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

async function createSubtask(parentId: string, summary: string, description: string) {
    try {
        // Get the project key from the parent issue ID (e.g., 'FA1' from 'FA1-58')
        const projectKey = parentId.split('-')[0];
        
        // First get the project's metadata to get available issue types
        const metadata = await fetchFromJira(`issue/createmeta?projectKeys=${projectKey}&expand=projects.issuetypes`);
        const project = metadata.projects[0];
        const subtaskType = project.issuetypes.find((type: any) => type.subtask === true);

        if (!subtaskType) {
            throw new Error('Subtask type not found in project');
        }

        const result = await fetchFromJira('issue', {
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

async function deleteTask(taskId: string, task: JiraTask) {
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

    if (confirm) {
        try {
            await fetchFromJira(`issue/${taskId}`, {
                method: 'DELETE'
            });
            console.log(chalk.green('Task deleted successfully!'));
        } catch (error: any) {
            console.error(chalk.red(`Error deleting task: ${error.message}`));
        }
    }
}

async function isGitRepo(): Promise<boolean> {
    const process = require('child_process');
    return new Promise((resolve) => {
        process.exec('git rev-parse --is-inside-work-tree', (error: any) => {
            resolve(!error);
        });
    });
}

async function getCurrentBranch(): Promise<string> {
    const process = require('child_process');
    return new Promise((resolve, reject) => {
        process.exec('git branch --show-current', (error: any, stdout: string) => {
            if (error) reject(error);
            resolve(stdout.trim());
        });
    });
}

async function branchExists(branchName: string): Promise<boolean> {
    const process = require('child_process');
    return new Promise((resolve) => {
        process.exec(`git branch --list ${branchName}`, (error: any, stdout: string) => {
            resolve(stdout.trim() !== '');
        });
    });
}

async function createBranch(branchName: string): Promise<void> {
    const process = require('child_process');
    return new Promise((resolve, reject) => {
        process.exec(`git checkout -b ${branchName}`, (error: any) => {
            if (error) reject(error);
            resolve();
        });
    });
}

async function switchToBranch(branchName: string): Promise<void> {
    const process = require('child_process');
    return new Promise((resolve, reject) => {
        process.exec(`git checkout ${branchName}`, (error: any) => {
            if (error) reject(error);
            resolve();
        });
    });
}

async function deleteBranch(branchName: string): Promise<void> {
    const process = require('child_process');
    return new Promise((resolve, reject) => {
        process.exec(`git branch -D ${branchName}`, (error: any) => {
            if (error) reject(error);
            resolve();
        });
    });
}

async function showTaskActions(task: JiraTask) {
    const isGitAvailable = await isGitRepo();
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
            await updateJiraTask(task.key, { summary, description });
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
            await createSubtask(task.key, subtaskDetails.summary, subtaskDetails.description);
            break;

        case 'delete':
            await deleteTask(task.key, task);
            break;

        case 'create-branch':
            try {
                const branchName = isSubtask ? await createSubtaskBranchName(task) : task.key;
                if (await branchExists(branchName)) {
                    console.log(chalk.yellow(`Branch '${branchName}' already exists.`));
                    return;
                }
                await createBranch(branchName);
                console.log(chalk.green(`Created and switched to branch '${branchName}'`));
            } catch (error: any) {
                console.error(chalk.red(`Error creating branch: ${error.message}`));
            }
            break;

        case 'goto-branch':
            try {
                const branchName = isSubtask ? await createSubtaskBranchName(task) : task.key;
                if (!await branchExists(branchName)) {
                    console.log(chalk.yellow(`Branch '${branchName}' does not exist.`));
                    return;
                }
                const currentBranch = await getCurrentBranch();
                if (currentBranch === branchName) {
                    console.log(chalk.yellow(`Already on branch '${branchName}'`));
                    return;
                }
                await switchToBranch(branchName);
                console.log(chalk.green(`Switched to branch '${branchName}'`));
            } catch (error: any) {
                console.error(chalk.red(`Error switching branch: ${error.message}`));
            }
            break;

        case 'delete-branch':
            try {
                const branchName = isSubtask ? await createSubtaskBranchName(task) : task.key;
                if (!await branchExists(branchName)) {
                    console.log(chalk.yellow(`Branch '${branchName}' does not exist.`));
                    return;
                }
                
                const currentBranch = await getCurrentBranch();
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
                    await deleteBranch(branchName);
                    console.log(chalk.green(`Branch '${branchName}' deleted successfully`));
                }
            } catch (error: any) {
                console.error(chalk.red(`Error deleting branch: ${error.message}`));
            }
            break;
    }
}

async function createSubtaskBranchName(task: JiraTask): Promise<string> {
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
                // Only allow alphanumeric characters, dashes, and underscores
                if (input && !/^[a-zA-Z0-9-_]*$/.test(input)) {
                    return 'Details can only contain letters, numbers, dashes, and underscores';
                }
                return true;
            }
        }
    ]);

    return details ? 
        `${type}/${task.key}/${details}` : 
        `${type}/${task.key}`;
}

program
    .name('jira')
    .description('JIRA CLI tool for task management')
    .version('1.0.0');

program
    .command('config')
    .description('Configure JIRA credentials')
    .action(async () => {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'baseUrl',
                message: 'Enter your JIRA instance URL (e.g., https://your-domain.atlassian.net):',
                validate: (input) => input.length > 0
            },
            {
                type: 'input',
                name: 'email',
                message: 'Enter your JIRA email:',
                validate: (input) => input.length > 0
            },
            {
                type: 'password',
                name: 'apiKey',
                message: 'Enter your JIRA API key:',
                validate: (input) => input.length > 0
            }
        ]);

        config.set('jiraConfig', answers);
        console.log(chalk.green('JIRA configuration saved successfully!'));
    });

program
    .command('tasks')
    .description('List and manage tasks')
    .option('-a, --all', 'Show subtasks as well')
    .argument('[taskId]', 'Specific task ID to manage')
    .option('-u, --update', 'Update the specified task')
    .option('-s, --subtask', 'Add subtask to the specified task')
    .option('-d, --delete', 'Delete the specified task')
    .action(async (taskId, options) => {
        try {
            if (taskId) {
                const task = await getTask(taskId);
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
                    await updateJiraTask(taskId, { summary, description });
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
                    await createSubtask(taskId, summary, description);
                } else if (options.delete) {
                    await deleteTask(task.key, task);
                } else {
                    await showTaskActions(task);
                }
            } else {
                const tasks = await getTasks();
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

                await showTaskActions(selectedTask);
            }
        } catch (error: any) {
            console.error(chalk.red(`Error: ${error.message}`));
        }
    });

program.parse();