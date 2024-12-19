import { Component, ChangeDetectorRef, Input, OnDestroy } from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Initial } from '@env/decorators/initial';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ConfigSchema, ConfigSchemaType } from '@platform/types/plugins';

@Component({
    selector: 'app-tabs-config-schema-bool',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ConfigSchemaBool extends ChangesDetector implements OnDestroy {
    @Input() public config!: ConfigSchema;
    //TODO AAZ: Check if this is needed. On String too!.
    @Input() public save!: (config: ConfigSchema) => void;

    public value?: boolean;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngOnDestroy(): void {
        //TODO AAZ: Save the value to the entry
        this.save(this.config);
    }
}

export interface ConfigSchemaBool extends IlcInterface {}
