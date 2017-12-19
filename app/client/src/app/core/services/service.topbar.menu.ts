
import {Injectable} from "@angular/core";

import { MenuItem } from './class.menu.item';

@Injectable()

export class ServiceTopBarMenuItems{
    getItems() : MenuItem[]{
        return [
            { icon : 'fa-upload',       caption : 'Open log file',              handle: 'openLocalFile',        type: 'item' },
            { icon : 'fa-plug',         caption : 'Open stream from serial',    handle: 'openSerialStream',     type: 'item' },
            { icon : 'fa-android',      caption : 'Open stream from ADB logcat',handle: 'openADBLogcatStream',  type: 'item' },
            { icon : 'fa-terminal',     caption : 'Terminal command',           handle: 'openTerminalCommand',  type: 'item' },
            { type : 'line' },
            { icon : 'fa-desktop',      caption : 'Add view',                   handle: 'addView',              type: 'item' },
            { type : 'line' },
            { icon : 'fa-cloud',        caption : 'Connect to service',         handle: 'connectionSettings',   type: 'item' },
            { type : 'line' },
            { icon : 'fa-paint-brush',  caption : 'Change color theme',         handle: 'changeThemeSettings',  type: 'item' },
            { type : 'line' },
            { icon : 'fa-child',        caption : 'About',                      handle: null,                   type: 'item' },
        ];
    }
}
