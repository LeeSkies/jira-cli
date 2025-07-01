export interface JiraConfig {
    email: string;
    apiKey: string;
    baseUrl: string;
    githubToken?: string;
}
export interface JiraComment {
    id: string;
    body: string;
    author: {
        displayName: string;
    };
    created: string;
}
export interface JiraTask {
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
        status: {
            id: string;
            name: string;
            statusCategory: {
                key: string;
            };
        };
        comment?: {
            comments: JiraComment[];
            total: number;
        };
        attachment?: {
            total: number;
            items: Array<{
                id: string;
                filename: string;
                content: string;
            }>;
        };
        parent?: {
            id: string;
            key: string;
            fields: {
                summary: string;
            };
        };
        sprint?: {
            id: number;
            name: string;
            state: string;
        };
        customfield_10020?: any;
    };
    transitions?: {
        id: string;
        name: string;
        to: {
            id: string;
            name: string;
        };
    }[];
}
