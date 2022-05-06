import {
    Component,
    Input,
    OnDestroy,
    ChangeDetectorRef,
    AfterContentInit,
    Output,
    EventEmitter,
} from '@angular/core';

@Component({
    selector: 'app-com-color-selector',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class ComColorSelectorComponent implements OnDestroy, AfterContentInit {
    @Input() public color!: string;
    @Input() public colors!: string[];

    @Output() public change = new EventEmitter();

    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef) {}

    public ngOnDestroy() {}

    public ngAfterContentInit() {}

    public _ng_onColorSelect(color: string) {
        this.color = color;
        this.change.emit(color);
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
