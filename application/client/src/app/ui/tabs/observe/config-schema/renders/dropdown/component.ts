import {
    Component,
    ChangeDetectorRef,
    Input,
    AfterContentInit,
    SimpleChanges,
} from '@angular/core';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { PluginConfigSchemaItem } from '@platform/types/bindings';
import { State } from '../../state';

@Component({
    selector: 'app-tabs-config-schema-dropdown',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    standalone: false,
})
export class ConfigSchemaDropdown extends ChangesDetector implements AfterContentInit {
    @Input() public config!: PluginConfigSchemaItem;
    @Input() public state!: State;

    public selectedOption?: string;
    public allOptions?: string[];

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    ngAfterContentInit(): void {
        const input_type = this.config.input_type;
        if (typeof input_type === 'object' && 'Dropdown' in input_type) {
            this.allOptions = input_type.Dropdown;
        }
    }

    public ngOnSelectionChange(event: SimpleChanges): void {
        const opt = event as unknown as string;
        this.state.saveConfig(this.config.id, {
            Dropdown: opt,
        });
    }
}
