export class Active {
    private _uuid: string | undefined;
    public set(uuid: string): void {
        this._uuid = uuid;
    }
    public get(): string | undefined {
        return this._uuid;
    }
}
