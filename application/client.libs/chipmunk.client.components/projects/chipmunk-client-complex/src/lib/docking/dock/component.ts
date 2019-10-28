import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef, AfterContentInit } from '@angular/core';
import { DockDef } from '../service';

@Component({
    selector: 'lib-complex-docking-dock',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class DockComponent implements AfterViewInit, OnDestroy, AfterContentInit {

    @Input() public dock: DockDef.IDock;

    public _ng_titleInjections: DockDef.IDockTitleContent[] = [];

    constructor(private _cdRef: ChangeDetectorRef) {

    }

    public ngOnDestroy() {
        this._ng_titleInjections = [];
    }

    public ngAfterViewInit() {
        if (this._ng_titleInjections.length === 0) {
            return;
        }
        this._cdRef.detectChanges();
    }

    public ngAfterContentInit() {
        if (this.dock === undefined || this.dock === null) {
            return;
        }
        if (this.dock.component === undefined || this.dock.component === null) {
            return;
        }
        if (this.dock.component.inputs === undefined) {
            this.dock.component.inputs = {};
        }
        this.dock.closable = typeof this.dock.closable === 'boolean' ? this.dock.closable : true;
        this.dock.component.inputs.injectTitleContent = this._injectTitleContent.bind(this);
        this.dock.component.inputs.rejectTitleContent = this._rejectTitleContent.bind(this);
    }

    private _injectTitleContent(content: DockDef.IDockTitleContent): Error | undefined {
        if (content.id === undefined) {
            return new Error(`Fail to add button. At least id should be defined.`);
        }
        this._ng_titleInjections.push(content);
    }

    private _rejectTitleContent(id: string | number) {
        this._ng_titleInjections = this._ng_titleInjections.filter((button: DockDef.IDockTitleContent) => {
            return button.id !== id;
        });
    }


}
