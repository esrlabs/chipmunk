import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Initial } from '@env/decorators/initial';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { ConfigSchema, ConfigSchemaType } from '@platform/types/plugins';

@Component({
    selector: 'app-tabs-config-schema-entry',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Initial()
@Ilc()
export class ConfgiSchemaEntry extends ChangesDetector {
    public readonly ConfigSchemaType = ConfigSchemaType;

    @Input() public config!: ConfigSchema;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public save(config: ConfigSchema) {
        //TODO AAZ: Check if saving directly to service is needed.
        //If not remove all ILC from all renders and entries.
    }
}
