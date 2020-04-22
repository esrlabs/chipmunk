// tslint:disable: member-ordering

import { Component, OnDestroy, ChangeDetectorRef, Input, HostBinding, HostListener, AfterContentInit, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Subscription, Observable, Subject } from 'rxjs';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import { ControllerFileMergeSession, IMergeFile } from '../../../../controller/controller.file.merge.session';

import ContextMenuService from '../../../../services/standalone/service.contextmenu';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-sidebar-app-files-item',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class SidebarAppMergeFilesItemComponent implements OnDestroy, AfterContentInit, AfterViewInit, OnChanges {

    @Input() public file: IMergeFile;
    @Input() public select: Observable<IMergeFile>;
    @Input() public controller: ControllerFileMergeSession;


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
            { /* delimiter */ },
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

    constructor(private _sanitizer: DomSanitizer, private _cdRef: ChangeDetectorRef) {
    }

    public ngAfterContentInit() {
        this._subscriptions.select = this.select.subscribe(this._onSelected.bind(this));
    }

    public ngAfterViewInit() {
    }

    public ngOnDestroy() {
        this._destroyed = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public ngOnChanges(changes: SimpleChanges) {
        if (changes.file === undefined) {
            return;
        }
        this._forceUpdate();
    }

    private _onSelected(file: IMergeFile | undefined) {
        const selected: boolean = file === undefined ? false : (this.file.path === file.path);
        if (this._selected !== selected) {
            this._selected = selected;
            this._forceUpdate();
        }
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
