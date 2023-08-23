import { popup, Service as UIPopupService } from '@ui/service/popup';
import { notifications, Service as UINotificationsService } from '@ui/service/notifications';
import { contextmenu, Service as UIContextmenuService } from '@ui/service/contextmenu';
import { layout, Service as UILayoutService } from '@ui/service/layout';
import { toolbar, Service as UIToolbarService } from '@ui/service/toolbar';
import { sidebar, Service as UISidebarService } from '@ui/service/sidebar';
import { styles, Service as UIStylesService } from '@ui/service/styles';
import { session, Service as SessionService } from '@service/session';
import { jobs, Service as JobsService } from '@service/jobs';
import { state, Service as StateService } from '@service/state';
import { bridge, Service as BridgeService } from '@service/bridge';
import { recent, Service as RecentService } from '@service/recent';
import { hotkeys, Service as HotkeysService } from '@service/hotkeys';
import { history, Service as HistoryService } from '@service/history';
import { listener, Service as ListenerService } from '@ui/service/listener';
import { lockers, Service as LockersService } from '@ui/service/lockers';
import { env, Service as EnvService } from '@service/env';
import { actions, Service as ActionsService } from '@service/actions';
import { settings, Service as Settings } from '@service/settings';
import { favorites, Service as Favorites } from '@service/favorites';
import { sys, Service as Sys } from '@service/sys';
import { changelogs, Service as Changelogs } from '@service/changelogs';

import { Logger } from '@platform/log';

export class Services {
    public readonly system: {
        session: SessionService;
        state: StateService;
        jobs: JobsService;
        bridge: BridgeService;
        recent: RecentService;
        hotkeys: HotkeysService;
        history: HistoryService;
        env: EnvService;
        actions: ActionsService;
        settings: Settings;
        favorites: Favorites;
        sys: Sys;
        changelogs: Changelogs;
    };
    public readonly ui: {
        popup: UIPopupService;
        notifications: UINotificationsService;
        contextmenu: UIContextmenuService;
        layout: UILayoutService;
        toolbar: UIToolbarService;
        sidebar: UISidebarService;
        styles: UIStylesService;
        listener: ListenerService;
        lockers: LockersService;
    };

    private readonly _owner: string;
    private readonly _logger: Logger;

    constructor(owner: string, logger: Logger) {
        this._owner = owner;
        this._logger = logger;
        this.system = {
            session,
            state,
            jobs,
            bridge,
            recent,
            hotkeys,
            history,
            env,
            actions,
            settings,
            favorites,
            sys,
            changelogs,
        };
        this.ui = {
            popup,
            notifications,
            contextmenu,
            layout,
            toolbar,
            sidebar,
            styles,
            listener,
            lockers,
        };
    }
}
