import { Component, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterViewInit, ViewChild, Input, AfterContentInit, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { ControllerSessionTab, IComponentInjection } from '../../../controller/controller.session.tab';
import { ControllerSessionTabStreamOutput, IStreamPacket } from '../../../controller/controller.session.tab.stream.output';

@Component({
    selector: 'app-views-output',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewOutputComponent implements OnDestroy, AfterViewInit, AfterContentInit {

    @ViewChild('outputviewport') _ng_outputAreaViewport: CdkVirtualScrollViewport;
    @ViewChild('outputwrapper') _ng_outputWrapperViewport: ElementRef;


    @Input() public session: ControllerSessionTab | undefined;

    public _ng_output: ControllerSessionTabStreamOutput | undefined;
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
        if (this._ng_outputAreaViewport === null || this._ng_outputAreaViewport === undefined) {
            return;
        }
    }

    ngAfterContentInit() {
        if (this.session === undefined) {
            return;
        }
        // Get reference to stream wrapper
        this._ng_output = this.session.getSessionStream().getOutputStream();
        // Get injections
        this._ng_injections.bottom = this.session.getOutputBottomInjections();
        // Make subscriptions
        this._subscriptions.updated = this._ng_output.getObservable().updated.subscribe(this._onUpdated.bind(this));
        this._subscriptions.scrollTo = this._ng_output.getObservable().scrollTo.subscribe(this._onScrollTo.bind(this));
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

    public _ng_trackByIdx(index: number, item: IStreamPacket) {
        return index;
    }

    public _ng_scrolledIndexChange(index: number) {
        // console.log(`_ng_scrolledIndexChange: ${index} / ${this._ng_outputAreaViewport.getRenderedRange().end}`);
        this._ng_output.setViewport(index, this._ng_outputAreaViewport.getRenderedRange().end);
    }

    private _updateOutputContainerSize() {
        if (this._ng_outputAreaViewport === null || this._ng_outputAreaViewport === undefined) {
            return;
        }
        const size = this._ng_outputWrapperViewport.nativeElement.getBoundingClientRect();
        this._ng_outputAreaSize.width = size.width;
        this._ng_outputAreaSize.height = size.height;
        this._cdRef.detectChanges();
        this._ng_outputAreaViewport.checkViewportSize();
    }

    private _autoScroll() {
        if (this._ng_outputAreaViewport === null || this._ng_outputAreaViewport === undefined) {
            return;
        }
        this._ng_outputAreaViewport.scrollTo({bottom: 0});
    }

    private _onUpdated() {
        this._updateOutputContainerSize();
        this._ng_output.setViewport(this._ng_outputAreaViewport.getRenderedRange().start, this._ng_outputAreaViewport.getRenderedRange().end);
        this._autoScroll();
    }

    private _onScrollTo(index: number) {
        this._ng_outputAreaViewport.scrollToIndex(index);
    }

}
