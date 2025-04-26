#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import { TasksCommand } from './commands/tasks';
import { ConfigCommand } from './commands/config';
import chalk from 'chalk';

const program = new Command();
const tasksCommand = new TasksCommand();

program
    .name('jira')
    .description('JIRA CLI tool for task management')
    .version('1.0.0')
    .option('-t, --task <taskId>', 'Specific task ID to manage')
    .option('-u, --update', 'Update the specified task')
    .option('-s, --subtask', 'Add subtask to the specified task')
    .option('-d, --delete', 'Delete the specified task')
    .option('-c, --change-status', 'Change status of the specified task')
    .option('-a, --all', 'Show all tasks from all users')
    .option('--status [status]', 'Filter tasks by status')
    .option('--search <query>', 'Search tasks by key, title, or description');

program
    .command('config')
    .description('Configure JIRA credentials')
    .action(async () => {
        const command = new ConfigCommand();
        await command.execute();
    });

// Default action (no command specified)
program.action(async (options) => {
    try {
        if (options.status !== undefined) {
            if (!options.status) {
                const statuses = await tasksCommand.getAvailableStatuses();
                const { selectedStatus } = await inquirer.prompt([{
                    type: 'list',
                    name: 'selectedStatus',
                    message: 'Select status to filter by:',
                    choices: statuses
                }]);
                options.status = selectedStatus;
            }
        }

        if (options.task) {
            const task = await tasksCommand.getTask(options.task);
            if (!task) {
                console.log(chalk.red('Task not found!'));
                return;
            }

            if (options.changeStatus) {
                const transitions = await tasksCommand.getAvailableTransitions(task.key);
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
                await tasksCommand.changeStatus(task.key, transitionId);
                return;
            }
            
            await tasksCommand.execute(options.task, options);
        } else if (options.search) {
            await tasksCommand.search(options.search);
        } else {
            await tasksCommand.execute(undefined, options);
        }
    } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
    }
});

program.parse();