import {
    Component,
    ChangeDetectorRef,
    AfterContentInit,
    ChangeDetectionStrategy,
    HostBinding,
    SkipSelf,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Popup } from '@ui/service/pupup';

@Component({
    selector: 'app-layout-popups',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class LayoutPopups extends ChangesDetector implements AfterContentInit {
    public popups: Map<string, { popup: Popup; close: () => void }> = new Map();
    protected visible: boolean = false;

    @HostBinding('class') get visability() {
        return this.visible ? 'visible' : 'hidden';
    }

    constructor(@SkipSelf() selfCdRef: ChangeDetectorRef, cdRef: ChangeDetectorRef) {
        super([selfCdRef, cdRef]);
    }

    public ngAfterContentInit(): void {
        this.ilc().channel.ui.popup.open((popup: Popup) => {
            popup.options.component.inputs === undefined && (popup.options.component.inputs = {});
            popup.options.component.inputs.close = this._close.bind(this, popup.uuid);
            this.popups.set(popup.uuid, { popup, close: this._close.bind(this, popup.uuid) });
            this.visible = true;
            this.ilc().services.ui.popup.setCount(this.popups.size);
            this.ilc().emitter.ui.popup.updated(this.popups.size);
            this.detectChanges();
        });
        this.ilc().channel.ui.popup.close((uuid: string) => {
            this._close(uuid);
        });
    }

    public onBGClick(): void {
        this.popups.forEach((popup, uuid) => {
            if (popup.popup.options.closeOnBGClick === false) {
                return;
            }
            this._close(uuid);
        });
    }

    private _close(uuid: string): void {
        const stored = this.popups.get(uuid);
        if (stored === undefined) {
            return;
        }
        stored.popup.options.closed !== undefined && stored.popup.options.closed();
        this.popups.delete(uuid);
        this.popups.size === 0 && (this.visible = false);
        this.ilc().services.ui.popup.setCount(this.popups.size);
        this.ilc().emitter.ui.popup.updated(this.popups.size);
        this.detectChanges();
    }
}
export interface LayoutPopups extends IlcInterface {}
