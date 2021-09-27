import { Directive, ElementRef, AfterContentInit, Input, OnDestroy } from '@angular/core';
import { Subscription, Subject } from 'rxjs';

@Directive({
    selector: '[appScrollIntoView]',
})
export class ScrollIntoViewDirective implements AfterContentInit, OnDestroy {
    @Input() public trigger!: Subject<void>;

    private _subscription: Subscription | undefined;

    constructor(private host: ElementRef) {}

    public ngAfterContentInit() {
        this._subscription = this.trigger.asObservable().subscribe(() => {
            setTimeout(() => {
                this.host.nativeElement.scrollIntoView();
            }, 100);
        });
    }

    public ngOnDestroy() {
        if (this._subscription === undefined) {
            return;
        }
        this._subscription.unsubscribe();
    }
}
