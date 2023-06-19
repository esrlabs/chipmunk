import { Component, Input, ChangeDetectorRef, ElementRef, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { getSourceColor } from '@ui/styles/colors';
import { Element } from '../element';

@Component({
    selector: 'app-views-observed-list-item-signature',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Signature extends ChangesDetector implements AfterContentInit {
    @Input() element!: Element;
    @Input() id!: number | undefined;

    public selected!: boolean;

    constructor(cdRef: ChangeDetectorRef, private _self: ElementRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.selected = this.element.selected;
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
