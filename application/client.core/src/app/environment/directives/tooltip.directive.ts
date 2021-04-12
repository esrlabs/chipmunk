import {
    Directive,
    Input,
    HostListener,
    TemplateRef,
    ElementRef,
    ComponentRef,
    OnInit,
    OnDestroy
} from '@angular/core';
import { Overlay, OverlayPositionBuilder, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { ComTooltipComponent } from '../components/common/tooltip/component';

@Directive({
    selector: '[appTooltip]',
})
export class ToolTipDirective implements OnInit, OnDestroy {
    @Input() public appTooltipText: string;
    @Input() public appTooltipContent: TemplateRef<any>;
    @Input() public appTooltipRefreshRate: number | undefined;

    private _overlayRef: OverlayRef;

    constructor(
        private _overlay: Overlay,
        private _overlayPositionBuilder: OverlayPositionBuilder,
        private _elementRef: ElementRef,
    ) {}

    public ngOnInit() {
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

    @HostListener('mouseenter') show() {
        if (this._overlayRef && !this._overlayRef.hasAttached()) {
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
        this.closeToolTip();
    }

    private closeToolTip() {
        if (this._overlayRef) {
            this._overlayRef.detach();
        }
    }
}
