import { SafeHtml } from '@angular/platform-browser';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { FormControl } from '@angular/forms';
import { wrapMatchesToSafeHtml } from '@ui/env/globals';

export class Recent {
    public value: string = '';
    public filter: string = '';

    private _valueLowerCase: string = '';
    private _filterLowerCase: string = '';

    constructor(value: string) {
        this.value = value;
        this._valueLowerCase = value.toLowerCase();
    }

    public html(): SafeHtml {
        return wrapMatchesToSafeHtml(this.filter, this.value);
    }

    public setFilter(filter: string) {
        this.filter = filter;
        this._filterLowerCase = filter.toLowerCase();
    }

    public filtered(): boolean {
        return this._valueLowerCase.indexOf(this._filterLowerCase) !== -1;
    }
}

export class RecentList {
    public items: Recent[] = [
        new Recent('error'),
        new Recent('error 2'),
        new Recent('warning 1'),
        new Recent('error 3'),
        new Recent('warning 2'),
        new Recent('error 4'),
        new Recent('warning 3'),
    ];
    public filter: string = '';
    public observer: Observable<Recent[]>;

    constructor(control: FormControl) {
        this.observer = control.valueChanges.pipe(
            startWith(''),
            map((filter: string) => {
                this.setFilter(filter);
                return this.items.filter((i) => i.filtered());
            }),
        );
    }
    public setFilter(filter: string) {
        this.filter = filter.trim() === '' ? '' : filter;
        this.items.forEach((i) => i.setFilter(this.filter));
    }
}
