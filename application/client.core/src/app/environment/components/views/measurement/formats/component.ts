import { Component, Input, AfterViewInit, OnDestroy, ChangeDetectorRef, ViewContainerRef, AfterContentInit, OnChanges, SimpleChanges, SimpleChange } from '@angular/core';
import { Subscription } from 'rxjs';
import { ControllerSessionTabTimestamp, IFormat } from '../../../../controller/controller.session.tab.timestamp';
import { IMenuItem } from '../../../../services/standalone/service.contextmenu';
import { DialogsMeasurementAddFormatComponent } from '../../../dialogs/measurement.format.add/component';

import ContextMenuService from '../../../../services/standalone/service.contextmenu';
import PopupsService from '../../../../services/standalone/service.popups';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-views-measurement-formats',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewMeasurementFormatsComponent implements AfterViewInit, AfterContentInit, OnDestroy, OnChanges {

    @Input() controller: ControllerSessionTabTimestamp;

    public _ng_formats: IFormat[] = [];

    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewMeasurementFormatsComponent');
    private _destroyed: boolean = false;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {

    }

    ngAfterContentInit() {
    }

    ngAfterViewInit() {
        this._onFormatsChange();
        this._subscribe();
    }

    ngOnDestroy() {
        this._unsubscribe();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes.controller === undefined) {
            return;
        }
        this._unsubscribe();
        this._subscribe();
    }

    public _ng_onContexMenu(event: MouseEvent, selection?: IFormat) {
        const items: IMenuItem[] = [
            {
                caption: `Remove`,
                handler: () => {
                    this.controller.removeFormatDef(selection.format);
                },
                disabled: selection === undefined,
            },
            {
                caption: `Remove All & Detect`,
                handler: this._ng_onResetAndDetect.bind(this),
            }
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    public _ng_onAddFormat() {
        const guid: string = PopupsService.add({
            id: 'measurement-time-add-format-dialog',
            options: {
                closable: false,
                width: 40,
            },
            caption: `Add new format`,
            component: {
                factory: DialogsMeasurementAddFormatComponent,
                inputs: {
                    controller: this.controller,
                    add: (format: IFormat) => {
                        PopupsService.remove(guid);
                        this.controller.addFormat(format);
                    },
                    cancel: () => {
                        PopupsService.remove(guid);
                    }
                }
            }
        });
    }

    public _ng_onResetAndDetect() {
        this.controller.discover(true).catch((err: Error) => {
            this._logger.warn(`Fail to detect datetime format due error: ${err.message}`);
        });
    }

    private _subscribe() {
        this._subscriptions._onFormatsChange = this.controller.getObservable().formats.subscribe(this._onFormatsChange.bind(this));
    }

    private _unsubscribe() {
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
    }

    private _onFormatsChange() {
        this._ng_formats = this.controller.getFormats();
        this._forceUpdate();
    }

    private _forceUpdate() {
        if (this._destroyed) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
