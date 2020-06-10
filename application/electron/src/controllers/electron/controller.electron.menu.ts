import { app, Menu } from 'electron';
import { FileParsers } from '../files.parsers/index';
import { IStorageScheme } from '../../services/service.storage';

import ServiceStorage from '../../services/service.storage';
import ServiceFileOpener from '../../services/files/service.file.opener';
import ServiceFileRecent from '../../services/files/service.file.recent';
import FunctionOpenLocalFile from './menu.functions/function.file.local.open';
import HandlerItemAbout from './menu.functions/handler.item.about';
import HandlerItemPlugins from './menu.functions/handler.item.plugins';
import HandlerItemSettings from './menu.functions/handler.item.settings';

import Logger from '../../tools/env.logger';

import * as os from 'os';

const MAX_NUMBER_OF_RECENT_FILES = 20;

const MENU_TEMPLATE = [
    {
        label: 'File',
        submenu: [ ],
    },
    {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'pasteandmatchstyle' },
            { role: 'delete' },
            { role: 'selectall' },
        ],
    },
    {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forcereload' },
            { role: 'toggledevtools' },
            { type: 'separator' },
            { role: 'resetzoom' },
            { role: 'zoomin' },
            { role: 'zoomout' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
        ],
    },
    {
        role: 'window',
        submenu: [
            { role: 'minimize' },
            { role: 'close', accelerator: 'Shift+CmdOrCtrl+W' },
        ],
    },
];

export default class ControllerElectronMenu {

    private _menu: any;
    private _logger: Logger = new Logger('ControllerElectronMenu');

    constructor() {
        this._create();
    }

    public rebuild() {
        this._create();
    }

    private _getTemplate(items?: any[]) {
        return (items === undefined ? MENU_TEMPLATE : items).map((item) => {
            const _item = Object.assign({}, item);
            if (_item.submenu instanceof Array) {
                _item.submenu = this._getTemplate(_item.submenu);
            }
            return _item;
        });
    }

    private _create() {
        const template: any = this._getTemplate();
        // Add files submenu
        template[0].submenu.push(...this._getFilesLocalSubmenu());
        // Add recent files (if it exists)
        if (ServiceStorage.get().get().recentFiles.length > 0) {
            template[0].submenu.push({ type: 'separator' });
            template[0].submenu.push({
                label: 'Open Recent',
                submenu: [
                    ...this._getRecentFiles(),
                    { type: 'separator' },
                    {
                        label: 'Clear',
                        click: () => {
                            ServiceFileRecent.clear();
                        },
                    },
                ],
            });

        }
        template[0].submenu.push({ type: 'separator' });
        template[0].submenu.push({
            label: 'Plugins',
            click: HandlerItemPlugins,
        });
        // Add platform related items
        if (process.platform === 'darwin') {
            template.unshift({
                label: app.getName(),
                submenu: [
                    {
                        label: 'About Chipmunk',
                        click: HandlerItemAbout,
                    },
                    { type: 'separator' },
                    { role: 'services' },
                    { type: 'separator' },
                    { role: 'hide' },
                    { role: 'hideothers' },
                    { role: 'unhide' },
                    { type: 'separator' },
                    {
                        label: 'Settings',
                        click: HandlerItemSettings,
                    },
                    { type: 'separator' },
                    { role: 'quit' },
                ],
            });
            // Window menu
            template[4].submenu = [
                { role: 'close' },
                { role: 'minimize' },
                { role: 'zoom' },
                { type: 'separator' },
                { role: 'front' },
            ];
        } else {
            template[0].submenu.push({ type: 'separator' });
            template[0].submenu.push({
                label: 'Settings',
                click: HandlerItemSettings,
            });
            template[0].submenu.push({ type: 'separator' });
            template[0].submenu.push({
                label: 'About Chipmunk',
                click: HandlerItemAbout,
            });
        }
        this._menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(this._menu);
    }

    private _getFilesLocalSubmenu(): Array<{ label: string, click: () => any }> {
        const wrapper: FunctionOpenLocalFile = new FunctionOpenLocalFile(FileParsers.map((parser) => {
            return new parser.class();
        }));
        return [{
            label: wrapper.getLabel(),
            click: wrapper.getHandler(),
        }];
    }

    private _getRecentFiles(): Array<{ label: string, click: () => any }> {
        const home: string = os.homedir();
        return ServiceStorage.get().get().recentFiles.slice(0, MAX_NUMBER_OF_RECENT_FILES).map((file: IStorageScheme.IRecentFile) => {
            return {
                label: `${(file.size / 1024 / 1024).toFixed(2)}Mb: ${file.file.replace(home, '~')}`,
                click: () => {
                    ServiceFileOpener.openAsNew(file.file).catch((error: Error) => {
                        this._logger.warn(`Fail to open file "${file.file}" due error: ${error.message}`);
                    });
                },
            };
        });
    }
}
