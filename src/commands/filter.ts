import inquirer from 'inquirer';
import chalk from 'chalk';
import { JiraService } from '../services/jira';
import { TasksCommand } from './tasks';
import { JiraUser } from '../types';

export class FilterCommand {
    private jiraService: JiraService;
    private tasksCommand: TasksCommand;

    constructor() {
        this.jiraService = new JiraService();
        this.tasksCommand = new TasksCommand();
    }

    async execute(filterType?: string): Promise<void> {
        let selectedUser: string | undefined;
        let selectedStatus: string | undefined;

        try {
            // Handle initial filter type selection or direct filtering
            if (!filterType) { // No filter type specified, prompt for both
                // Prompt for user
                console.log(chalk.yellow('Fetching users...'));
                const users: JiraUser[] = await this.jiraService.searchUsers('');
                const userChoices = [{ name: 'All', value: 'all' }].concat(users.map((user: any) => ({
                    name: user.displayName,
                    value: user.accountId
                })));
                const { userChoice } = await inquirer.prompt([{
                    type: 'list',
                    name: 'userChoice',
                    message: 'Select a user:',
                    choices: userChoices,
                    loop: false
                }]);
                selectedUser = userChoice === 'all' ? undefined : userChoice;

                // Prompt for status
                const statuses = await this.jiraService.getAvailableStatuses();
                const statusChoices = [{ name: 'All', value: 'all' }].concat(statuses.map((status: string) => ({
                    name: status,
                    value: status
                })));
                const { statusChoice } = await inquirer.prompt([{
                    type: 'list',
                    name: 'statusChoice',
                    message: 'Select a status:',
                    choices: statusChoices,
                    loop: false
                }]);
                selectedStatus = statusChoice === 'all' ? undefined : statusChoice;

            } else {
                const lowerCaseFilterType = filterType.toLowerCase();
                if (lowerCaseFilterType === 'user') { // Filter by user only
                    console.log(chalk.yellow('Fetching users...'));
                    const users: JiraUser[] = await this.jiraService.searchUsers('');
                    const userChoices = [{ name: 'All', value: 'all' }].concat(users.map((user: any) => ({
                        name: user.displayName,
                        value: user.accountId
                    })));
                    const { userChoice } = await inquirer.prompt([{
                        type: 'list',
                        name: 'userChoice',
                        message: 'Select a user:',
                        choices: userChoices,
                        loop: false
                    }]);
                    selectedUser = userChoice === 'all' ? undefined : userChoice;
                    selectedStatus = undefined; // Assume 'All' for status

                } else if (lowerCaseFilterType === 'status') { // Filter by status only
                    const statuses = await this.jiraService.getAvailableStatuses();
                    const statusChoices = [{ name: 'All', value: 'all' }].concat(statuses.map((status: string) => ({
                        name: status,
                        value: status
                    })));
                    const { statusChoice } = await inquirer.prompt([{
                        type: 'list',
                        name: 'statusChoice',
                        message: 'Select a status:',
                        choices: statusChoices,
                        loop: false
                    }]);
                    selectedStatus = statusChoice === 'all' ? undefined : statusChoice;
                    selectedUser = undefined; // Assume 'All' for user

                } else {
                    console.log(chalk.red(`Invalid filter type: ${filterType}. Please use 'user' or 'status'.`));
                    return;
                }
            }

            const tasks = await this.jiraService.getTasksByFilters(selectedUser, selectedStatus);
            await this.tasksCommand.displayAndHandleTasks(tasks);

        } catch (error: any) {
            console.error(chalk.red(`Error during filtering: ${error.message}`));
        }
    }
}
