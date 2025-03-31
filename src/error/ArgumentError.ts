export class ArgumentError extends Error {
    private argumentName: string;
    constructor(argumentName: string, message: string) {
        super(`${message}`);
        this.name = 'ArgumentError';
        this.argumentName = argumentName;
    }

    get argument(): string {
        return this.argumentName;
    }
}