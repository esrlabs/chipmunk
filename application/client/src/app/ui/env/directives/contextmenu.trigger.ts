import { AfterViewInit, Directive, OnDestroy, HostListener, Input } from '@angular/core';

@Directive({
    selector: '[appContextMenuTrigger]',
})
export class ContextMenuTriggerDirective implements AfterViewInit, OnDestroy {
    @Input() public menu!: string;
    private _menuRef!: HTMLElement;
    private _position:
        | {
              x: number;
              y: number;
          }
        | undefined;

    constructor() { // private _hostElement: ElementRef
        this._mouseup = this._mouseup.bind(this);
        window.addEventListener('mouseup', this._mouseup);
    }

    @HostListener('contexmenu', ['$event']) _contexmenu(event: MouseEvent) {
        this._position = { x: event.x, y: event.y };
    }

    public ngAfterViewInit() {
        // (this._hostElement.nativeElement as HTMLElement).focus();
    }

    public ngOnDestroy(): void {
        window.removeEventListener('mouseup', this._mouseup);
    }

    private _mouseup(event: MouseEvent) {
        this._position = undefined;
        console.log(event);
    }
}
