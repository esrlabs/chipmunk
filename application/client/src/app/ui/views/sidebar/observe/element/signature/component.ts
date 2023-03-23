import { Component, Input, ChangeDetectorRef, ElementRef, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { DataSource } from '@platform/types/observe';
import { getSourceColor } from '@ui/styles/colors';

@Component({
    selector: 'app-views-observed-list-item-signature',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Signature extends ChangesDetector implements AfterContentInit {
    @Input() source!: DataSource;
    @Input() id!: number | undefined;

    constructor(cdRef: ChangeDetectorRef, private _self: ElementRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        // const filename = this.source.source.asFile();
        // if (filename !== undefined) {
        //     (this as Mutable<List>).filename = filename;
        // }
    }

    public getSourceMarkerStyles(): { [key: string]: string } {
        return this.id === undefined
            ? {}
            : {
                  background: getSourceColor(this.id),
              };
    }
}
export interface List extends IlcInterface {}
