import { ChangeDetectorRef } from '@angular/core';

export class ChangesDetector {
    private _changeDetectorRef: ChangeDetectorRef;
    private _detauched: boolean = false;

    constructor(changeDetectorRef: ChangeDetectorRef) {
        this._changeDetectorRef = changeDetectorRef;
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
