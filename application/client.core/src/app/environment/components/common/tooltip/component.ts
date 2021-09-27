import {
    Component,
    Input,
    OnDestroy,
    ChangeDetectorRef,
    AfterViewInit,
    TemplateRef,
} from '@angular/core';

@Component({
    selector: 'app-com-tooltip',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class ComTooltipComponent implements OnDestroy, AfterViewInit {
    @Input() public appTooltipText!: string;
    @Input() public appTooltipContent!: TemplateRef<any>;
    @Input() public appTooltipRefreshRate: number | undefined;

    private _refreshTimer: any;

    constructor(private _cdRef: ChangeDetectorRef) {
        this._update = this._update.bind(this);
    }

    public ngOnDestroy() {
        clearTimeout(this._refreshTimer);
    }

    public ngAfterViewInit() {
        if (
            typeof this.appTooltipRefreshRate === 'number' &&
            !isNaN(this.appTooltipRefreshRate) &&
            isFinite(this.appTooltipRefreshRate)
        ) {
            this._update();
        }
    }

    private _update() {
        this._cdRef.detectChanges();
        this._refreshTimer = setTimeout(this._update, this.appTooltipRefreshRate);
    }
}
