import {
    Directive,
    Input,
    HostListener,
    TemplateRef,
    ElementRef,
    ComponentRef,
    OnDestroy,
} from '@angular/core';
import { Overlay, OverlayPositionBuilder, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ComTooltipComponent } from '../components/common/tooltip/component';

@Directive({
    selector: '[appTooltip]',
})
export class ToolTipDirective implements OnDestroy {
    @Input() public appTooltipText!: string;
    @Input() public appTooltipContent!: TemplateRef<any>;
    @Input() public appTooltipRefreshRate: number | undefined;

    private _overlayRef!: OverlayRef;

    constructor(
        private _overlay: Overlay,
        private _overlayPositionBuilder: OverlayPositionBuilder,
        private _elementRef: ElementRef,
    ) {}

    @HostListener('mouseenter') show() {
        if (this._overlayRef === undefined) {
            const positionStrategy = this._overlayPositionBuilder
                .flexibleConnectedTo(this._elementRef)
                .withPositions([
                    {
                        originX: 'center',
                        originY: 'bottom',
                        overlayX: 'center',
                        overlayY: 'top',
                        offsetY: 5,
                        offsetX: 5,
                    },
                ]);
            this._overlayRef = this._overlay.create({ positionStrategy });
        }
        if (!this._overlayRef.hasAttached()) {
            const tooltipRef: ComponentRef<ComTooltipComponent> = this._overlayRef.attach(
                new ComponentPortal(ComTooltipComponent),
            );
            tooltipRef.instance.appTooltipText = this.appTooltipText;
            tooltipRef.instance.appTooltipContent = this.appTooltipContent;
            tooltipRef.instance.appTooltipRefreshRate = this.appTooltipRefreshRate;
        }
    }

    @HostListener('mouseleave') hide() {
        this.closeToolTip();
    }

    public ngOnDestroy() {
        this.closeToolTip(true);
    }

    private closeToolTip(destroy: boolean = false) {
        if (this._overlayRef) {
            this._overlayRef.detach();
            if (destroy) {
                this._overlayRef.dispose();
            }
        }
    }
}
