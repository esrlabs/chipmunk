export class EntityEditState {
    private _edit: boolean = false;

    public in() {
        this._edit = true;
    }

    public out() {
        this._edit = false;
    }

    public state(): boolean {
        return this._edit;
    }
}
