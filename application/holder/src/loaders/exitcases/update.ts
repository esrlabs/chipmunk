export class Update {
    public readonly updater: string;
    public readonly disto: string;
    public readonly app: string;

    constructor(updater: string, disto: string, app: string) {
        this.updater = updater;
        this.disto = disto;
        this.app = app;
    }
}
