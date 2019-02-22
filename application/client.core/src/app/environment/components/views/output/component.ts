import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import * as Tools from '../../../tools/index';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { ControllerSession, IComponentInjection } from '../../../controller/controller.session';
import { IStreamPacket } from '../../../controller/controller.session.stream';
import { ControllerSessionStreamOutput } from '../../../controller/controller.session.stream.output';

@Component({
    selector: 'app-views-output',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewOutputComponent implements OnDestroy, AfterViewInit, AfterContentInit {

    @ViewChild('outputviewport') _ng_outputAreaViewport: CdkVirtualScrollViewport;
    @ViewChild('outputwrapper') _ng_outputWrapperViewport: ElementRef;


    @Input() public session: ControllerSession | undefined;

    public _ng_output: ControllerSessionStreamOutput | undefined;
    public _ng_injections: {
        bottom: Map<string, IComponentInjection>,
    } = {
        bottom: new Map()
    };

    public _ng_outputAreaSize: {
        height: number;
        width: number;
    } = {
        width: 0,
        height: 0,
    };

    private _subscriptions: { [key: string]: Subscription | undefined } = { };

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {

    }

    ngAfterViewInit() {
        this._updateOutputContainerSize();
    }

    ngAfterContentInit() {
        if (this.session === undefined) {
            return;
        }
        // Get reference to stream wrapper
        this._ng_output = this.session.getSessionStream().getOutputStream();
        // Get injections
        this._ng_injections.bottom = this.session.getOutputBottomInjections();

    }

    public ngOnDestroy() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    public _ng_getOutputAreaStyle(): { [key: string]: string | number } {
        return {
            'width': `${this._ng_outputAreaSize.width}px`,
            'height': `${this._ng_outputAreaSize.height}px`,
        };
    }

    public _ng_onBrowserWindowResize() {
        this._updateOutputContainerSize();
    }

    private _updateOutputContainerSize() {
        if (this._vcRef === null || this._vcRef === undefined) {
            return;
        }
        const size = this._ng_outputWrapperViewport.nativeElement.getBoundingClientRect();
        this._ng_outputAreaSize.width = size.width;
        this._ng_outputAreaSize.height = size.height;
        this._cdRef.detectChanges();
        this._ng_outputAreaViewport.checkViewportSize();
    }

}
