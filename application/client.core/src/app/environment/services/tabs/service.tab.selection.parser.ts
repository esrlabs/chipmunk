import * as Toolkit from 'chipmunk.client.toolkit';

import { Subscription } from 'rxjs';
import { SidebarAppParsingComponent } from '../../components/sidebar/parsing/component';
import { IService } from '../../interfaces/interface.service';
import { IUpdateEvent } from '../standalone/service.selection.parsers';

import ToolbarSessionsService from '../service.sessions.toolbar';
import SelectionParsersService from '../standalone/service.selection.parsers';

export { IUpdateEvent };

export class TabSelectionParserService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('TabSelectionParserService');
    private _subscriptions: { [key: string]: Subscription } = {};
    private _tabGuid: string = Toolkit.guid();
    private _last: IUpdateEvent | undefined;

    constructor() {
        this._subscriptions.onUpdate = SelectionParsersService.getObservable().onUpdate.subscribe(this._onUpdate.bind(this));
    }

    public init(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    public getName(): string {
        return 'TabSelectionParserService';
    }

    public desctroy(): Promise<void> {
        return new Promise((resolve) => {
            Object.keys(this._subscriptions).forEach((key: string) => {
                this._subscriptions[key].unsubscribe();
            });
            resolve();
        });
    }

    public getLastSelection(): IUpdateEvent | undefined {
        return this._last;
    }

    private _onUpdate(event: IUpdateEvent) {
        this._last = event;
        if (ToolbarSessionsService.has(this._tabGuid)) {
            ToolbarSessionsService.setActive(this._tabGuid, undefined, false).catch((error: Error) => this._logger.error(error.message));
            return;
        }
        ToolbarSessionsService.add('Details', {
            factory: SidebarAppParsingComponent,
            inputs: {
                selection: event.selection,
                parsed: event.parsed,
                caption: event.caption,
                getLastSelection: this.getLastSelection.bind(this),
            },
            resolved: false,
        }, this._tabGuid);
    }
}

export default (new TabSelectionParserService());
