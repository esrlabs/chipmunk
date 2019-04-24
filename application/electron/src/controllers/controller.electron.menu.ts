import { app, Menu } from 'electron';
import FunctionOpenTextFile from './functions/function.file.text.open';
import FunctionOpenDltFile from './functions/function.file.dlt.open';

const MENU_TEMPLATE = [
    {
        label: 'File',
        submenu: [
            { label: FunctionOpenTextFile.getLabel(), click: FunctionOpenTextFile.handler() },
            { label: FunctionOpenDltFile.getLabel(), click: FunctionOpenDltFile.handler() },
        ],
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
            { role: 'close' },
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
}
