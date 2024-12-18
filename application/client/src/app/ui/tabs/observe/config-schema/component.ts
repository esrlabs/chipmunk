import { Component, ChangeDetectorRef, AfterContentInit } from '@angular/core';
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
export class ConfigSchemas extends ChangesDetector implements AfterContentInit {
    public readonly state: State = new State();

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngAfterContentInit(): void {
        //TODO AAZ: Check if this is needed.
    }

    public reload(schemas: ConfigSchema[]) {
        this.state.reload(schemas);
        this.detectChanges();
    }
}

export interface ConfigSchemas extends IlcInterface {}
