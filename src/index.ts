#!/usr/bin/env node

import { Command } from 'commander';
import { TasksCommand } from './commands/tasks';
import { ConfigCommand } from './commands/config';

const program = new Command();

program
    .name('jira')
    .description('JIRA CLI tool for task management')
    .version('1.0.0');

program
    .command('config')
    .description('Configure JIRA credentials')
    .action(async () => {
        const command = new ConfigCommand();
        await command.execute();
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
        const command = new TasksCommand();
        await command.execute(taskId, options);
    });

program.parse();