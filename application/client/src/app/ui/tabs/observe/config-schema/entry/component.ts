import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { PluginConfigSchemaItem, PluginConfigSchemaType } from '@platform/types/bindings/plugins';
import { State } from '../state';

@Component({
    selector: 'app-tabs-config-schema-entry',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
export class ConfgiSchemaEntry extends ChangesDetector {
    @Input() public config!: PluginConfigSchemaItem;
    @Input() public state!: State;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    isDropdownItem(schema: PluginConfigSchemaType): schema is { Dropdown: Array<string> } {
        return typeof schema === 'object' && 'Dropdown' in schema;
    }

    isFilesPicker(schema: PluginConfigSchemaType): schema is { Files: Array<string> } {
        return typeof schema === 'object' && 'Files' in schema;
    }
}
