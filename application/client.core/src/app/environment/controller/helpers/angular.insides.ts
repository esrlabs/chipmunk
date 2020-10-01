export function tryDetectChanges(comRef: any) {
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
