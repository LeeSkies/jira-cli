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
        const currentConfig = this.jiraService.getConfig();

        const answers = await inquirer.prompt<JiraConfig>([
            {
                type: 'input',
                name: 'baseUrl',
                message: 'Enter your JIRA instance URL (e.g., https://your-domain.atlassian.net):',
                default: currentConfig?.baseUrl,
                validate: (input) => input.length > 0
            },
            {
                type: 'input',
                name: 'email',
                message: 'Enter your JIRA email:',
                default: currentConfig?.email,
                validate: (input) => input.length > 0
            },
            {
                type: 'password',
                name: 'apiKey',
                message: 'Enter your JIRA API key:',
                default: currentConfig?.apiKey,
                validate: (input) => input.length > 0
            },
            {
                type: 'password',
                name: 'githubToken',
                message: 'Enter your GitHub Personal Access Token (optional):',
                default: currentConfig?.githubToken
            }
        ]);

        // Fetch projects after initial config is set (temporarily)
        this.jiraService.saveConfig(answers); // Save temporarily to allow project fetching

        console.log(chalk.yellow('Fetching your Jira projects...'));
        const projects = await this.jiraService.getProjects();

        if (projects.length === 0) {
            console.log(chalk.yellow('No projects found. Please ensure your credentials are correct and you have access to projects.'));
            // Re-save config without defaultProjectKey if no projects found
            this.jiraService.saveConfig(answers);
            return;
        }

        const projectChoices = projects.map((project: any) => ({
            name: `${project.name} (${project.key})`,
            value: project.key
        }));

        const { defaultProjectKey } = await inquirer.prompt([{
            type: 'list',
            name: 'defaultProjectKey',
            message: 'Select your default Jira project:',
            choices: projectChoices,
            default: currentConfig?.defaultProjectKey,
            pageSize: 10,
            loop: false
        }]);

        const finalConfig: JiraConfig = {
            ...answers,
            defaultProjectKey
        };

        this.jiraService.saveConfig(finalConfig);
        console.log(chalk.green('JIRA configuration saved successfully!'));
    }
}