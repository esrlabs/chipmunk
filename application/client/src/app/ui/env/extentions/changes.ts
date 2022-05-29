import { ChangeDetectorRef } from '@angular/core';

export class ChangesDetector {
    private _changeDetectorRef: ChangeDetectorRef;
    private _detauched: boolean = false;

    constructor(changeDetectorRef: ChangeDetectorRef) {
        this._changeDetectorRef = changeDetectorRef;
    }

    public static detectChanges(comRef: any) {
        if (typeof comRef !== 'object' || comRef === null) {
            return;
        }
        if (typeof comRef._changeDetectorRef !== 'object' || comRef._changeDetectorRef === null) {
            return;
        }
        if (typeof comRef._changeDetectorRef.detectChanges !== 'function') {
            return;
        }
        comRef._changeDetectorRef.detectChanges();
    }

    public detauchChangesDetector() {
        this._detauched = true;
    }

    public detectChanges() {
        if (this._detauched) {
            return;
        }
        this._changeDetectorRef.detectChanges();
    }

    public markChangesForCheck() {
        if (this._detauched) {
            return;
        }
        this._changeDetectorRef.markForCheck();
    }

    public reattachChangesDetector() {
        if (this._detauched) {
            return;
        }
        this._changeDetectorRef.reattach();
    }
}
