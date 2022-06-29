export class State {
    public pos: number = 0;
    public selected: number = 0;
    public len: number = 0;
    public found: number = 0;

    public drop() {
        this.pos = 0;
        this.selected = 0;
        this.len = 0;
        this.found = 0;
    }

    public isEmpty(): boolean {
        return this.pos + this.len === 0;
    }
}
