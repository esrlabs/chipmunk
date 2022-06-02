import { Component, Input, AfterContentInit } from '@angular/core';
import { trigger, transition, animate, style, state } from '@angular/animations';

import { Ilc, IlcInterface } from '@env/decorators/component';
import { DragAndDropService, ListContent } from '../draganddrop/service';

@Component({
    selector: 'app-sidebar-filters-bin',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    animations: [
        trigger('inOut', [
            state(
                'in',
                style({
                    opacity: '1',
                }),
            ),
            state(
                'out',
                style({
                    opacity: '0.0000001',
                }),
            ),
            transition('in => out', [animate('0.2s')]),
            transition('out => in', [animate('0.2s')]),
        ]),
    ],
})
@Ilc()
export class Bin implements AfterContentInit {
    @Input() draganddrop!: DragAndDropService;

    public dragging: boolean = false;
    public listID: ListContent = ListContent.binList;

    private _droppedListID: ListContent | undefined;
    private _droppedOut: boolean = false;
    private _ignore: boolean | undefined;

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.draganddrop.subjects.drag.subscribe((status) => {
                this.dragging = status;
            }),
        );
        this.env().subscriber.register(
            this.draganddrop.subjects.mouseOver.subscribe((listID) => {
                if (!this.dragging) {
                    return;
                }
                if (listID !== this.listID) {
                    // Special case for bin
                    this._ignore = true;
                }
                this._droppedListID = listID;
                this._droppedOut = false;
                this.draganddrop.onMouseOverBin(true);
            }),
        );
        this.env().subscriber.register(
            this.draganddrop.subjects.mouseOverGlobal.subscribe((event) => {
                if (this.dragging && !this._ignore) {
                    this._droppedOut = true;
                    this.draganddrop.onMouseOverBin(false);
                } else {
                    this._ignore = false;
                }
            }),
        );
    }

    public _ng_onListDropped() {
        if (this._droppedListID === this.listID && !this._droppedOut) {
            this.draganddrop.onBinDrop();
        }
        this.dragging = false;
    }
}
export interface Bin extends IlcInterface {}
