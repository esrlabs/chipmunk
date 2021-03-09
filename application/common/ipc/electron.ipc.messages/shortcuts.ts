export interface IShortcuts {
    error?: string;
}

export class Shortcuts {

    public static signature: string = 'Shortcuts';
    public signature: string = Shortcuts.signature;
    public error: string | undefined;

    constructor(params: IShortcuts) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for ShellShortcuts message`);
        }
        this.error = params.error;
    }
}
