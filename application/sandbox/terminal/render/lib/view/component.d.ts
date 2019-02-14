import { OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
export declare class ViewComponent implements AfterViewInit, OnDestroy {
    private _cdRef;
    title: string;
    items: string[];
    private _timer;
    constructor(_cdRef: ChangeDetectorRef);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    private _next;
}
