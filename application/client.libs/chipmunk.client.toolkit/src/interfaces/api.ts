import * as Components from './components';
import * as Enums from '../consts/enums';
import { ControllerViewportEvents } from '../controllers/controller.viewport.events';
import { ControllerSessionsEvents } from '../controllers/controller.sessions.events';
import { PluginIPC } from '../classes/class.ipc';
import { IPopup } from './client.popup';
import { IComponentDesc } from './client.components.containers';

export interface IAPI {
    getIPC: () => PluginIPC | undefined;
    getActiveSessionId: () => string;
    addOutputInjection: (injection: Components.IComponentInjection, type: Enums.EViewsTypes) => void;
    removeOutputInjection: (id: string, type: Enums.EViewsTypes) => void;
    getViewportEventsHub: () => ControllerViewportEvents;
    getSessionsEventsHub: () => ControllerSessionsEvents;
    addPopup: (popup: IPopup) => string;
    removePopup: (guid: string) => void;
    setSidebarTitleInjection: (component: IComponentDesc | undefined) => void;
}
