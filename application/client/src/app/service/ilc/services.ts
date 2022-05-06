import { popup, Service as UIPopupService } from '@ui/service/pupup';
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

import { Instance as Logger } from '@platform/env/logger';

export class Services {
    public readonly system: {
        session: SessionService;
        state: StateService;
        jobs: JobsService;
        bridge: BridgeService;
    };
    public readonly ui: {
        popup: UIPopupService;
        notifications: UINotificationsService;
        contextmenu: UIContextmenuService;
        layout: UILayoutService;
        toolbar: UIToolbarService;
        sidebar: UISidebarService;
        styles: UIStylesService;
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
        };
        this.ui = {
            popup,
            notifications,
            contextmenu,
            layout,
            toolbar,
            sidebar,
            styles,
        };
    }

    public destroy() {}
}
