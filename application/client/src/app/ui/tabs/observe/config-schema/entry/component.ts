import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { ConfigSchema, ConfigSchemaType } from '@platform/types/plugins';
import { State } from '../state';

@Component({
    selector: 'app-tabs-config-schema-entry',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class ConfgiSchemaEntry extends ChangesDetector {
    @Input() public config!: ConfigSchema;
    @Input() public state!: State;

    public readonly ConfigSchemaType = ConfigSchemaType;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }
}
