import {
    Component,
    ChangeDetectorRef,
    Input,
    ViewChild,
    ElementRef,
    AfterContentInit,
    AfterViewInit,
    EventEmitter,
    Output,
    ViewEncapsulation,
    OnDestroy,
    ChangeDetectionStrategy,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Controll } from './input';
import { List } from '@env/storages/recent/list';
import { Recent } from '@env/storages/recent/item';
import { Subject } from '@platform/env/subscription';
import { ErrorState, NullErrorState } from './error';
import { stop } from '@ui/env/dom';

interface Options {
    defaults: string;
    storage: string;
    name: string;
    placeholder: string;
    label: string;
    inlineLabel?: string;
    recent: Subject<string | undefined>;
    error?: ErrorState;
}

export { ErrorState, Options };

@Component({
    selector: 'app-autocomplete-input',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
})
@Ilc()
export class AutocompleteInput
    extends ChangesDetector
    implements OnDestroy, AfterContentInit, AfterViewInit
{
    @Input() public options!: Options;

    @Output() public edit: EventEmitter<string> = new EventEmitter();
    @Output() public enter: EventEmitter<string> = new EventEmitter();
    @Output() public panel: EventEmitter<boolean> = new EventEmitter();

    @ViewChild('input') inputRef!: ElementRef<HTMLInputElement>;
    @ViewChild('input', { read: MatAutocompleteTrigger }) panelRef!: MatAutocompleteTrigger;

    public control!: Controll;
    public recent!: List;
    public error!: ErrorState;

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this.control.destroy();
    }

    public ngAfterContentInit(): void {
        this.control = new Controll();
        this.recent = new List(this.control.control, this.options.name, this.options.storage);
        this.error = this.options.error !== undefined ? this.options.error : new NullErrorState();
        this.control.set(this.options.defaults);
    }

    public ngAfterViewInit(): void {
        this.env().subscriber.register(
            this.control.actions.edit.subscribe((value: string) => {
                this.edit.emit(value);
                this.detectChanges();
            }),
            this.control.actions.enter.subscribe((value: string) => {
                this.enter.emit(value);
                this.detectChanges();
            }),
            this.control.actions.panel.subscribe((opened: boolean) => {
                this.panel.emit(opened);
                this.detectChanges();
            }),
            this.options.recent.subscribe((value: string | undefined) => {
                value = value === undefined ? this.control.value : value;
                value.trim() !== '' && this.recent.update(value);
            }),
            this.error.observer().subscribe(() => {
                this.detectChanges();
            }),
        );
        this.control.bind(this.inputRef.nativeElement, this.panelRef);
    }

    public ngRemove(recent: Recent, event: MouseEvent) {
        this.recent.remove(recent.value);
        this.detectChanges();
        stop(event);
    }

    public disable(): AutocompleteInput {
        this.control.disable();
        this.detectChanges();
        return this;
    }

    public enable(): AutocompleteInput {
        this.control.enable();
        this.detectChanges();
        return this;
    }

    public set(value: string): AutocompleteInput {
        this.control.set(value);
        this.detectChanges();
        return this;
    }

    public focus(): AutocompleteInput {
        this.inputRef.nativeElement.focus();
        return this;
    }
}
export interface AutocompleteInput extends IlcInterface {}
