import { Component, ChangeDetectorRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { ConfigSchema } from '@platform/types/plugins';

@Component({
    selector: 'app-tab-config-schemas',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ConfigSchemas extends ChangesDetector implements OnChanges {
    @Input() schemas!: ConfigSchema[];

    public readonly state: State = new State();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['schemas']) {
            this.state.reload(this.schemas);
        }
    }
}

export interface ConfigSchemas extends IlcInterface {}
