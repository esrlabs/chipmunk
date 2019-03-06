import { OnDestroy, ChangeDetectorRef, AfterViewInit, ElementRef } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
export declare class ViewComponent implements AfterViewInit, OnDestroy {
    private _cdRef;
    private _sanitizer;
    _ng_input: ElementRef;
    ipc: any;
    session: string;
    _ng_safeHtml: SafeHtml;
    private _subscription;
    constructor(_cdRef: ChangeDetectorRef, _sanitizer: DomSanitizer);
    ngOnDestroy(): void;
    ngAfterViewInit(): void;
    _ng_onKeyUp(event: KeyboardEvent): void;
}
