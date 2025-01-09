import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { PluginConfigSchemaItem, PluginConfigSchemaType } from '@platform/types/bindings/plugins';
import { State } from '../state';

@Component({
    selector: 'app-tabs-config-schema-entry',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class ConfgiSchemaEntry extends ChangesDetector {
    @Input() public config!: PluginConfigSchemaItem;
    @Input() public state!: State;

    //TODO AAZ: Check if this is needed.
    // public readonly ConfigSchemaType = ConfigSchemaType;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }
}
