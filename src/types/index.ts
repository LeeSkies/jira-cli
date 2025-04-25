export interface JiraConfig {
    email: string;
    apiKey: string;
    baseUrl: string;
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
    };
}