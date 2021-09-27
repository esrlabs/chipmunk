import { Directive, OnDestroy, HostListener } from '@angular/core';
import { CdkDragRelease, CdkDragMove } from '@angular/cdk/drag-drop';
import { getPropByPath } from '../controller/helpers/obj';

import * as Toolkit from 'chipmunk.client.toolkit';

@Directive({
    selector: '[appMatDragDropResetFeature]',
    exportAs: 'appMatDragDropResetFeatureRef',
})
export class MatDragDropResetFeatureDirective implements OnDestroy {
    private _anchor: HTMLElement | undefined;
    private _logger: Toolkit.Logger = new Toolkit.Logger('MatDragDropResetFeatureDirective');
    private _timer: any;

    @HostListener('cdkDragMoved', ['$event']) _cdkDragMoved(event: CdkDragMove) {
        if (this._anchor !== undefined) {
            return;
        }
        const placeholder: HTMLElement | undefined = this._getPlaceholder(event);
        if (placeholder === undefined || placeholder.parentElement === null) {
            return;
        }
        this._anchor = this._getAnchor();
        placeholder.parentElement.insertBefore(this._anchor, placeholder);
    }

    @HostListener('cdkDragReleased', ['$event']) _cdkDragReleased(event: CdkDragRelease) {
        this._timer = setTimeout(this._dropAnchor.bind(this), 250);
    }

    constructor() {}

    public ngOnDestroy() {
        clearTimeout(this._timer);
        this._dropAnchor();
    }

    public reset(event: CdkDragRelease): Error | undefined {
        if (this._anchor === undefined) {
            return new Error(
                this._logger.warn(`Anchor isn't created, even cdkDragReleased is triggered.`),
            );
        }
        const placeholder: HTMLElement | undefined = this._getPlaceholder(event);
        if (placeholder === undefined || this._anchor.parentNode === null) {
            this._dropAnchor();
            return new Error(this._logger.warn(`Fail to find placeholder on cdkDragReleased`));
        }
        this._anchor.parentNode.insertBefore(placeholder, this._anchor);
        placeholder.style.transform = '';
        this._dropAnchor();
        return undefined;
    }

    private _getPlaceholder(event: CdkDragMove | CdkDragRelease): HTMLElement | undefined {
        const placeholder: HTMLElement | Error = getPropByPath(
            event,
            'source._dragRef._placeholder',
        );
        if (placeholder instanceof Error) {
            this._logger.warn(
                `Fail get placeholder from event (CdkDragMove | CdkDragRelease) due error: ${placeholder.message}`,
            );
            return undefined;
        }
        if (placeholder === undefined || placeholder === null) {
            this._logger.warn(`Placeholder isn't initialized yet.`);
            return undefined;
        }
        return placeholder;
    }

    private _getAnchor(): HTMLElement {
        const anchor = document.createElement('span');
        anchor.style.display = 'none';
        return anchor;
    }

    private _dropAnchor() {
        if (this._anchor === undefined || this._anchor.parentNode === null) {
            return;
        }
        this._anchor.parentNode.removeChild(this._anchor);
        this._anchor = undefined;
    }
}
