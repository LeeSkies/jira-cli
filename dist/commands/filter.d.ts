export declare class FilterCommand {
    private jiraService;
    private tasksCommand;
    constructor();
    execute(filterType?: string): Promise<void>;
}
