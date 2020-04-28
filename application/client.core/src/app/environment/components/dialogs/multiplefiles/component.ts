import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';

interface IFileInfo {
    name: string;
    modified: number;
    modifiedStr: string;
    size: number;
}

@Component({
    selector: 'app-views-dialogs-multiplefilescation-map',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DialogsMultipleFilesActionComponent implements AfterContentInit {

    @Input() files: File[] = [];

    constructor(private _cdRef: ChangeDetectorRef) {
    }

    ngAfterContentInit() {
    }

}
