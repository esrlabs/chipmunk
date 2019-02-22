import { OnDestroy, ChangeDetectorRef, AfterViewInit, ElementRef } from '@angular/core';
export declare class ViewComponent implements AfterViewInit, OnDestroy {
    private _cdRef;
    _ng_input: ElementRef;
    ipc: any;
    session: string;
    constructor(_cdRef: ChangeDetectorRef);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    _ng_onKeyUp(event: KeyboardEvent): void;
}
