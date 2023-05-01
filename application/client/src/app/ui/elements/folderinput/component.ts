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
    ChangeDetectionStrategy,
    OnDestroy,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { Controll } from './input';
import { FoldersList } from './folders';
import { ErrorState } from './error';

interface Options {
    placeholder: string;
    label?: string;
    defaults: string;
    passive: boolean;
}

export { ErrorState, Options };

@Component({
    selector: 'app-folderinput-input',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
})
@Ilc()
export class FolderInput
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
    public folders!: FoldersList;
    public error: ErrorState = new ErrorState();

    constructor(cdRef: ChangeDetectorRef, private _sanitizer: DomSanitizer) {
        super(cdRef);
    }

    public ngOnDestroy(): void {
        this.control.destroy();
    }

    public ngAfterContentInit(): void {
        this.control = new Controll();
        this.folders = new FoldersList(this.control.control);
        this.control.set(this.options.defaults);
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
            this.error.subject.subscribe(() => {
                this.edit.emit(this.control.value);
                this.detectChanges();
            }),
        );
    }

    public ngAfterViewInit(): void {
        this.control.bind(this.inputRef.nativeElement, this.panelRef);
    }

    public disable(): FolderInput {
        this.control.disable();
        this.detectChanges();
        return this;
    }

    public enable(): FolderInput {
        this.control.enable();
        this.detectChanges();
        return this;
    }

    public set(value: string): FolderInput {
        this.control.set(value);
        this.folders.setParent();
        this.detectChanges();
        return this;
    }

    public focus(): FolderInput {
        this.inputRef.nativeElement.focus();
        return this;
    }

    public select() {
        this.ilc()
            .services.system.bridge.folders()
            .select()
            .then((paths: string[]) => {
                if (paths.length !== 1) {
                    return;
                }
                this.set(paths[0]);
            });
    }

    public home() {
        this.ilc()
            .services.system.bridge.os()
            .homedir()
            .then((path: string) => {
                this.set(path);
            });
    }

    public safeHtml(html: string): SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(html);
    }
}
export interface FolderInput extends IlcInterface {}
