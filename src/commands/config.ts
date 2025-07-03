import inquirer from 'inquirer';
import chalk from 'chalk';
import { JiraService } from '../services/jira';
import { JiraConfig, JiraProject } from '../types';
import { GitService } from '../services/git';
import inquirerPrompt from 'inquirer-autocomplete-prompt';

inquirer.registerPrompt('autocomplete', inquirerPrompt);

export class ConfigCommand {
    private jiraService: JiraService;
    private gitService: GitService;

    constructor() {
        this.jiraService = new JiraService();
        this.gitService = new GitService();
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
            },
            {
                type: 'input',
                name: 'cacheDurationDays',
                message: 'Enter cache duration in days (e.g., 7 for a week, 0 to disable caching):',
                default: currentConfig?.cacheDurationDays ?? 7,
                validate: (input) => {
                    const num = Number(input);
                    if (isNaN(num) || num < 0) {
                        return 'Please enter a valid positive number for cache duration.';
                    }
                    return true;
                },
                filter: Number
            }
        ]);

        // Fetch projects after initial config is set (temporarily)
        this.jiraService.saveConfig(answers); // Save temporarily to allow project fetching

        console.log(chalk.yellow('Fetching your Jira projects...'));
        const projects: JiraProject[] = await this.jiraService.getProjects();

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

        let baseDevelopmentBranch: string | undefined;
        const isGit = await this.gitService.isGitRepo();
        console.log(`Is Git Repo: ${isGit}`);
        const branches = isGit ? await this.gitService.listLocalBranches() : [];
        console.log(`Branches found: ${branches.length}`);
        console.log(`Branches: ${JSON.stringify(branches)}`);
        const { selectedBranch } = await inquirer.prompt([{
            type: 'autocomplete',
            name: 'selectedBranch',
            message: 'Select your base development branch for pull requests (e.g., develop, main): (optional)',
            source: (answersSoFar: any, input: string) => {
                return Promise.resolve(branches.filter(branch => branch.includes(input || '')));
            },
            default: currentConfig?.baseDevelopmentBranch || '',
            pageSize: 20 // Display more branches
        }]);
        baseDevelopmentBranch = selectedBranch;

        const finalConfig: JiraConfig = {
            ...answers,
            defaultProjectKey,
            baseDevelopmentBranch
        };

        this.jiraService.saveConfig(finalConfig);
        console.log(chalk.green('JIRA configuration saved successfully!'));
    }
}