import * as Components from './components';
import * as Enums from '../consts/enums';
import { ControllerViewportEvents } from '../controllers/controller.viewport.events';
import { ControllerSessionsEvents } from '../controllers/controller.sessions.events';
import { PluginIPC } from '../classes/class.ipc';

export interface IAPI {
    getIPC: () => PluginIPC | undefined;
    getActiveSessionId: () => string;
    addOutputInjection: (injection: Components.IComponentInjection, type: Enums.EViewsTypes) => void;
    removeOutputInjection: (id: string, type: Enums.EViewsTypes) => void;
    getViewportEventsHub: () => ControllerViewportEvents;
    getSessionsEventsHub: () => ControllerSessionsEvents;
}
