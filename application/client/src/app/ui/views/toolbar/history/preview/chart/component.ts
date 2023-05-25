import { Component, Input, ChangeDetectorRef } from '@angular/core';
import { ChartRequest } from '@service/session/dependencies/search/charts/request';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';

@Component({
    selector: 'app-toolbar-history-chart-preview',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class ChartPreview extends ChangesDetector {
    @Input() chart!: ChartRequest;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }
}
export interface ChartPreview extends IlcInterface {}
