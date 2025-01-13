import { Component, Input, ChangeDetectorRef } from '@angular/core';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-toolbar-history-filter-preview',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
@Ilc()
export class FilterPreview extends ChangesDetector {
    @Input() filter!: FilterRequest;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }
}
export interface FilterPreview extends IlcInterface {}
