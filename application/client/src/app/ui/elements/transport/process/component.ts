import {
    Component,
    ChangeDetectorRef,
    Input,
    ViewChild,
    ElementRef,
    AfterViewInit,
    OnDestroy,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Controll } from './input';
import { List } from '@env/storages/recent/list';

@Component({
    selector: 'app-transport-process',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class TransportProcess extends ChangesDetector implements AfterViewInit, OnDestroy {
    @Input() public state!: State;
    @ViewChild('commandinput') commandInputRef!: ElementRef<HTMLInputElement>;
    @ViewChild('cmdinput') cmdInputRef!: ElementRef<HTMLInputElement>;
    @ViewChild('commandinput', { read: MatAutocompleteTrigger })
    commandsPanelRef!: MatAutocompleteTrigger;
    @ViewChild('cmdinput', { read: MatAutocompleteTrigger }) cmdPanelRef!: MatAutocompleteTrigger;

    public readonly inputs: {
        command: {
            input: Controll;
            recent: List;
        };
        cwd: {
            input: Controll;
            recent: List;
        };
    };

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
        const command = new Controll();
        const cwd = new Controll();
        this.inputs = {
            command: {
                input: command,
                recent: new List(
                    command.control,
                    'CommandsRecentList',
                    'processes_commands_recent',
                ),
            },
            cwd: {
                input: cwd,
                recent: new List(cwd.control, 'CmdRecentList', 'processes_cmd_recent'),
            },
        };
    }

    public ngOnDestroy(): void {
        this.state.destroy();
    }

    public ngAfterViewInit(): void {
        this.inputs.command.input.bind(this.commandInputRef.nativeElement, this.commandsPanelRef);
        this.inputs.cwd.input.bind(this.cmdInputRef.nativeElement, this.cmdPanelRef);
        this.inputs.command.input.actions.edit.subscribe((value: string) => {
            this.state.command = value;
            // this.inputs.command.recent.update(this.inputs.command.input.value);
        });
        this.inputs.command.input.actions.recent.subscribe(() => {
            this.markChangesForCheck();
        });
        this.inputs.cwd.input.actions.edit.subscribe((value: string) => {
            this.state.cwd = value;
            // this.inputs.cwd.recent.update(this.inputs.cwd.input.value);
        });
        this.inputs.cwd.input.actions.recent.subscribe(() => {
            this.markChangesForCheck();
        });
        this.state.subjects.get().accepted.subscribe(() => {
            this.inputs.command.recent.update(this.state.command);
            this.inputs.cwd.recent.update(this.state.cwd);
        });
    }
}
export interface TransportProcess extends IlcInterface {}
