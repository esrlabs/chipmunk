export class Filter {
    private _filter: string = '';
    public keyboard(event: KeyboardEvent): boolean {
        if (event.code === 'Backspace') {
            if (this._filter.length > 0) {
                this._filter = this._filter.substring(0, this._filter.length - 1);
                return true;
            }
        } else if (event.code === 'Escape' || event.code === 'Enter') {
            if (this._filter !== '') {
                this.drop();
                return true;
            }
        } else if (event.key.length === 1 && this._filter.length < 50) {
            this._filter += event.key;
            if (this._filter.trim() === '') {
                this.drop();
            }
            return true;
        }
        return false;
    }
    public isEmpty(): boolean {
        return this._filter.trim() === '';
    }
    public value(): string {
        return this._filter;
    }
    public drop(): boolean {
        if (this._filter === '') {
            return false;
        }
        this._filter = '';
        return true;
    }
}
