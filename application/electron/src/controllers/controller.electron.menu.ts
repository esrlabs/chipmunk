import { app, Menu } from 'electron';
import { FileParsers } from './files.parsers/index';
import FunctionOpenLocalFile from './functions/function.file.local.open';

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

    constructor() {
        this._create();
    }

    private _create() {
        const template: any = MENU_TEMPLATE;
        // Add files submenu
        template[0].submenu.push(...this._getFilesLocalSubmenu());
        // Add platform related items
        if (process.platform === 'darwin') {
            template.unshift({
                label: app.getName(),
                submenu: [
                    { role: 'about' },
                    { type: 'separator' },
                    { role: 'services' },
                    { type: 'separator' },
                    { role: 'hide' },
                    { role: 'hideothers' },
                    { role: 'unhide' },
                    { type: 'separator' },
                    { role: 'quit' },
                ],
            });
            // Edit menu
            template[2].submenu.push(
                { type: 'separator' },
                {
                    label: 'Speech',
                    submenu: [
                        { role: 'startspeaking' },
                        { role: 'stopspeaking' },
                    ],
                },
            );
            // Window menu
            template[4].submenu = [
                { role: 'close' },
                { role: 'minimize' },
                { role: 'zoom' },
                { type: 'separator' },
                { role: 'front' },
            ];
        }
        this._menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(this._menu);
    }

    private _getFilesLocalSubmenu(): Array<{ label: string, click: () => any }> {
        const items: Array<{ label: string, click: () => any }> = FileParsers.map((parser) => {
            const wrapper: FunctionOpenLocalFile = new FunctionOpenLocalFile(new parser.class());
            return {
                label: wrapper.getLabel(),
                click: wrapper.getHandler(),
            };
        });
        return items;
    }
}
