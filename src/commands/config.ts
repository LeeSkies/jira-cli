import inquirer from 'inquirer';
import chalk from 'chalk';
import { JiraService } from '../services/jira';
import { JiraConfig } from '../types';

export class ConfigCommand {
    private jiraService: JiraService;

    constructor() {
        this.jiraService = new JiraService();
    }

    async execute(): Promise<void> {
        const answers = await inquirer.prompt<JiraConfig>([
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
            },
            {
                type: 'password',
                name: 'githubToken',
                message: 'Enter your GitHub Personal Access Token (optional):'
            }
        ]);

        this.jiraService.saveConfig(answers);
        console.log(chalk.green('JIRA configuration saved successfully!'));
    }
}