#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import { TasksCommand } from './commands/tasks';
import { ConfigCommand } from './commands/config';
import { FilterCommand } from './commands/filter';
import { CacheCommand } from './commands/cache';
import chalk from 'chalk';

const program = new Command();
const tasksCommand = new TasksCommand();

program
    .name('jira')
    .description('JIRA CLI tool for task management')
    .version('1.0.0')
    .option('-t, --task <taskId>', 'Specific task ID to manage')
    .option('-u, --update', 'Update the specified task')
    .option('-s, --search <query>', 'Search tasks by title')
    .option('--subtask', 'Add subtask to the specified task')
    .option('-d, --delete', 'Delete the specified task')
    .option('-c, --change-status', 'Change status of the specified task')
    .option('-a, --all', 'Show all tasks from all users')
    .option('--status [status]')
    .option('-n, --exclude <query>', 'Exclude results with specified terms')
    .option('-f, --filter [type]', 'Filter tasks by user or status')

program
    .command('config')
    .description('Configure JIRA credentials')
    .action(async () => {
        const command = new ConfigCommand();
        await command.execute();
    });

program
    .command('cache [type]')
    .description('Manage CLI cache (e.g., clear users, statuses, projects, or all)')
    .action(async (type) => {
        const command = new CacheCommand();
        await command.execute(type);
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

            if (options.subtask) {
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
                await tasksCommand.createSubtask(options.task, summary, description);
                return;
            }
            
            await tasksCommand.execute(options.task, options);
        } else if (options.search) {
            await tasksCommand.search(options.search, options.exclude);
        } else if (options.filter) {
            const filterCommand = new FilterCommand();
            // If -f is used without an argument, commander passes true. Convert to undefined.
            const filterArg = options.filter === true ? undefined : options.filter;
            await filterCommand.execute(filterArg);
        } else {
            await tasksCommand.execute(undefined, options);
        }
    } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
    }
});

program.parse();