import * as Toolkit from 'logviewer.client.toolkit';
import { Subscription } from 'rxjs';
import HorizontalSidebarSessionsService from '../service.sessions.sidebar.horizontal';
import { SidebarAppParsingComponent } from '../../components/sidebar/parsing/component';
import SelectionParsersService, { IUpdateEvent } from '../standalone/service.selection.parsers';
import { IService } from '../../interfaces/interface.service';

export class TabSelectionParserService implements IService {

    private _logger: Toolkit.Logger = new Toolkit.Logger('TabSelectionParserService');
    private _subscriptions: { [key: string]: Subscription } = {};
    private _tabGuid: string = Toolkit.guid();

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

    private _onUpdate(event: IUpdateEvent) {
        if (HorizontalSidebarSessionsService.has(this._tabGuid)) {
            HorizontalSidebarSessionsService.setActive(this._tabGuid);
            return;
        }
        HorizontalSidebarSessionsService.add('Details', {
            factory: SidebarAppParsingComponent,
            inputs: {
                selection: event.selection,
                parsed: event.parsed,
                caption: event.caption
            },
            resolved: false,
        }, this._tabGuid);
    }
}

export default (new TabSelectionParserService());
