import {
    Component,
    ChangeDetectorRef,
    Input,
    ViewChild,
    ElementRef,
    AfterViewInit,
    EventEmitter,
    Output,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Controll } from './input';
import { List } from '@env/storages/recent/list';
import { Recent } from '@env/storages/recent/item';

export interface Options {
    defaults: string;
    storage: string;
    name: string;
    placeholder: string;
    label: string;
}

@Component({
    selector: 'app-autocomplete-input',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class AutocompleteInput extends ChangesDetector implements AfterViewInit {
    @Input() public options!: Options;
    @Output() public edit: EventEmitter<string> = new EventEmitter();
    @Output() public accept: EventEmitter<string> = new EventEmitter();
    @Output() public panel: EventEmitter<boolean> = new EventEmitter();

    @ViewChild('input') inputRef!: ElementRef<HTMLInputElement>;
    @ViewChild('input', { read: MatAutocompleteTrigger }) panelRef!: MatAutocompleteTrigger;

    public control!: Controll;
    public recent!: List;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterViewInit(): void {
        this.control = new Controll();
        this.recent = new List(this.control.control, this.options.name, this.options.storage);
        this.control.bind(this.inputRef.nativeElement, this.panelRef);
        this.control.actions.edit.subscribe((value: string) => {
            this.edit.emit(value);
        });
        this.control.actions.accept.subscribe((value: string) => {
            this.recent.update(value);
            this.accept.emit(value);
            this.markChangesForCheck();
        });
        this.control.actions.panel.subscribe((opened: boolean) => {
            this.panel.emit(opened);
            this.markChangesForCheck();
        });
        this.control.set(this.options.defaults);
    }

    public ngRemove(recent: Recent, event: MouseEvent) {
        this.recent.remove(recent.value);
        this.detectChanges();
        event.preventDefault();
        event.stopImmediatePropagation();
    }
}
export interface AutocompleteInput extends IlcInterface {}
