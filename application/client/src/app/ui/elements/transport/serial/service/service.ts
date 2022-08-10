class SerialService {
    private _selected: string = '';

    public setSelected(path: string): string {
        this._selected = path;
        return this._selected;
    }

    public get selected(): string {
        return this._selected;
    }
}

export default new SerialService();
