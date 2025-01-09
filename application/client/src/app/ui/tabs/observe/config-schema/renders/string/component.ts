import {
    Component,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    OnChanges,
    SimpleChanges,
} from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { PluginConfigSchemaItem } from '@platform/types/bindings/plugins';
import { State } from '../../state';

@Component({
    selector: 'app-tabs-config-schema-string',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class ConfigSchemaString extends ChangesDetector implements AfterContentInit, OnChanges {
    @Input() public config!: PluginConfigSchemaItem;
    @Input() public state!: State;

    public value?: string;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['value']) {
            this.state.saveConfig(this.config.id, {
                type: 'Text',
                value: changes['value'].currentValue,
            });
        }
    }

    ngAfterContentInit(): void {
        this.value = '';
        this.state.saveConfig(this.config.id, { type: 'Text', value: this.value });
    }

    public ngOnInputChange(event: Event): void {
        const target = event.target as HTMLInputElement;
        this.state.saveConfig(this.config.id, { type: 'Text', value: target?.value ?? '' });
    }
}
