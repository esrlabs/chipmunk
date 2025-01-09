import { Component, ChangeDetectorRef, Input, SimpleChange, AfterContentInit } from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { PluginConfigSchemaItem } from '@platform/types/bindings/plugins';
import { State } from '../../state';

@Component({
    selector: 'app-tabs-config-schema-bool',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class ConfigSchemaBool extends ChangesDetector implements AfterContentInit {
    @Input() public config!: PluginConfigSchemaItem;
    @Input() public state!: State;

    public value?: boolean;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngAfterContentInit(): void {
        this.value = false;
        this.state.saveConfig(this.config.id, { type: 'Boolean', value: this.value });
    }

    public ngOnCheckboxChange(event: SimpleChange): void {
        let val = event as unknown as boolean;
        this.state.saveConfig(this.config.id, { type: 'Boolean', value: val });
    }
}
