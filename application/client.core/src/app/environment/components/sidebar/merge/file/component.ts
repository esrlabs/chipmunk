// tslint:disable: member-ordering

import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    Input,
    HostBinding,
    HostListener,
    AfterContentInit,
    AfterViewInit,
    OnChanges,
    SimpleChanges,
} from '@angular/core';
import { Subscription, Observable, Subject } from 'rxjs';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import {
    ControllerFileMergeSession,
    IMergeFile,
    ITimeScale,
    EViewMode,
} from '../../../../controller/controller.file.merge.session';

import ContextMenuService from '../../../../services/standalone/service.contextmenu';

const CPadding = 12;

@Component({
    selector: 'app-sidebar-app-files-item',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
export class SidebarAppMergeFilesItemComponent
    implements OnDestroy, AfterContentInit, AfterViewInit, OnChanges
{
    @Input() public file!: IMergeFile;
    @Input() public select!: Observable<IMergeFile | undefined>;
    @Input() public controller!: ControllerFileMergeSession;
    @Input() public width!: number;
    @Input() public viewMode!: EViewMode;
    @Input() public timeLineVisibility!: boolean;

    @HostBinding('class.selected') get cssClassSelected() {
        return this._selected;
    }

    @HostListener('contextmenu', ['$event']) onContextMenu(event: MouseEvent) {
        const items: IMenuItem[] = [
            {
                caption: 'Remove',
                handler: () => {
                    this.controller.remove(this.file.path);
                },
            },
            {
                /* delimiter */
            },
            {
                caption: `Remove All`,
                handler: () => {
                    this.controller.drop();
                },
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    private _selected: boolean = false;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _destroyed: boolean = false;
    private _scale: {
        left: number;
        width: number;
        fWidth: number;
    } = {
        left: -1,
        width: -1,
        fWidth: -1,
    };

    constructor(private _cdRef: ChangeDetectorRef) {}

    public ngAfterContentInit() {
        this._subscriptions.select = this.select.subscribe(this._onSelected.bind(this));
        this._subscriptions.ScaleUpdated = this.controller
            .getObservable()
            .ScaleUpdated.subscribe(this._updateScale.bind(this));
    }

    public ngAfterViewInit() {
        this._updateScale();
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngOnChanges(changes: SimpleChanges) {
        if (changes.file === undefined && changes.width === undefined) {
            return;
        }
        this._updateScale();
    }

    public _ng_isScaleVisible(): boolean {
        return this._scale.left !== -1 && this.timeLineVisibility;
    }

    public _ng_getScaleStyle(): { [key: string]: string | number } {
        if (!this._ng_isScaleVisible()) {
            return {};
        }
        return {
            left: this._scale.left + 'px',
            width: this._scale.width + 'px',
        };
    }

    private _onSelected(file: IMergeFile | undefined) {
        const selected: boolean = file === undefined ? false : this.file.path === file.path;
        if (this._selected !== selected) {
            this._selected = selected;
            this._forceUpdate();
        }
    }

    private _updateScale() {
        this._scale.left = -1;
        this._scale.width = -1;
        if (!this.controller.isTimeScaleValid() || this.file.scale === undefined) {
            return;
        }
        const scale: ITimeScale = this.controller.getTimeScale();
        const rate: number = (this.width - CPadding) / (scale.sMax - scale.sMin);
        this._scale.width = (this.file.scale.sMax - this.file.scale.sMin) * rate;
        this._scale.left = (this.file.scale.sMin - scale.sMin) * rate;
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }
}
