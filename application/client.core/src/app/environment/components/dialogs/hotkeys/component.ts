import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';

interface IKey {
    shortkeys: string[];
    description: string;
}

interface IGroup {
    name: string;
    keys: IKey[];
}

@Component({
    selector: 'app-views-dialogs-hotkeys-map',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class DialogsHotkeysMapComponent implements AfterContentInit {
    @Input() keys: any;

    public _ng_groups: IGroup[] = [];

    constructor(private _cdRef: ChangeDetectorRef) {}

    ngAfterContentInit() {
        const groups: any = {};
        Object.keys(this.keys).forEach((key: string) => {
            if (groups[this.keys[key].category] === undefined) {
                groups[this.keys[key].category] = {
                    name: this.keys[key].category,
                    keys: [],
                };
            }
            groups[this.keys[key].category].keys.push({
                shortkeys: this.keys[key].shortkeys,
                description: this.keys[key].description,
            });
        });
        Object.keys(groups).forEach((key: string) => {
            this._ng_groups.push(groups[key]);
        });
        this._cdRef.detectChanges();
    }
}
