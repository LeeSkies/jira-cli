export interface GithubPullRequest {
    html_url?: string;
    // Add other fields as needed
}

export interface JiraConfig {
    baseUrl: string;
    email: string;
    apiKey: string;
    githubToken?: string;
    defaultProjectKey?: string;
    cacheDurationDays?: number;
    baseDevelopmentBranch?: string;
}

export interface JiraComment {
    id: string;
    author: { displayName: string };
    created: string;
    body: string;
}

export interface JiraIssueType {
    id: string;
    name: string;
    subtask: boolean;
}

export interface JiraStatus {
    id: string;
    name: string;
}

export interface JiraProject {
    id: string;
    key: string;
    name: string;
}

export interface JiraUser {
    accountId: string;
    displayName: string;
    emailAddress: string;
}

export interface JiraTransition {
    id: string;
    name: string;
    to: JiraStatus;
}

export interface JiraTask {
    key: string;
    id: string;
    fields: {
        summary: string;
        description: string;
        issuetype: JiraIssueType;
        status: JiraStatus;
        comment?: { comments: JiraComment[] };
        attachment?: { total: number };
        parent?: { key: string; fields: { summary: string } };
        subtasks: JiraTask[];
        customfield_10020?: Array<{ name: string; state: string }>; // Assuming this is for Sprint
    };
    transitions?: JiraTransition[];
}