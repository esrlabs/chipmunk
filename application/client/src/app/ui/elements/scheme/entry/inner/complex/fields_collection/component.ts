import { Component, ChangeDetectorRef, Input, AfterContentInit } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Element, FieldsCollectionElement } from '../../element';
import { FieldDesc } from '@platform/types/bindings';
import { Proivder } from './provider';

import * as obj from '@platform/env/obj';

@Component({
    selector: 'app-settings-scheme-fields-collection-selector',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Initial()
@Ilc()
export class FieldsCollection extends ChangesDetector implements AfterContentInit {
    @Input() element!: Element;
    @Input() inner!: FieldsCollectionElement;

    public desc: FieldDesc[] = [];
    public fields: FieldDesc[][] = [];
    public provider: Proivder = new Proivder();
    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        // this.desc = this.inner.elements.map((el) => {
        //     return { Static: el };
        // });
    }

    public ngOnAdd() {
        const fields = this.desc.map((field) => {
            return obj.clone(field);
        });
        this.fields.push(fields);
        this.detectChanges();
    }
}
export interface FieldsCollection extends IlcInterface {}
