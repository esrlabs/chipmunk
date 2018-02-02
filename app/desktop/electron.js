const { app, BrowserWindow } = require('electron');
const path              = require('path');
const url               = require('url');
const JSONSLocaltorage  = require('node-localstorage').JSONStorage;
const Updater           = require('./electron/application.updater');
const ApplicationMenu   = require('./electron/application.menu');
const util              = require('util');
const logger            = new (require('./server/libs/tools.logger'))('Electron');


const updater = new Updater();

class Starter {

    constructor(){
        this._app               = app;
        this._window            = null;
        this._ready             = false;
        this._storageLocaltion  = this._app.getPath('userData');
        this._storage           = new JSONSLocaltorage(this._storageLocaltion);
        this._version           = this._app.getVersion();
        this._menu              = new ApplicationMenu();
        this._app.on('ready',               this._onReady.bind(this));
        this._app.on('window-all-closed',   this._onWindowAllClosed.bind(this));
        this._app.on('activate',            this._onActivate.bind(this));
    }

    _getWindowState(){
        let state = {};
        try{
            state = this._storage.getItem('windowState');
        } catch (e){
            state = {};
        }
        return state === null ? {} : state;
    }

    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    _onReady(){
        this._create();
        this._menu.create();
        //updater.check();
        this._ready = true;
    }

    // Quit when all windows are closed.
    _onWindowAllClosed(){
        // On OS X it is common for applications and their menu bar
        // to stay active until the user quits explicitly with Cmd + Q
        if (process.platform !== 'darwin') {
            this._app.quit();
        }
    }

    _onActivate(){
        // On OS X it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        this._ready && this._create();
    }

    _create(){
        if (this._window === null) {
            this._createClient();
            this._createServer();
            //this.debug();
        }
    }

    _createClient(){
        let state = this._getWindowState();
        // Create the browser window.
        this._window = new BrowserWindow({
            title   : `LogViewer@${this._version}`,
            width   : state.bounds !== void 0 ? (state.bounds.width !== void 0 ? state.bounds.width: 850) : 850,
            height  : state.bounds !== void 0 ? (state.bounds.height !== void 0 ? state.bounds.height: 600) : 600,
            x       : state.bounds !== void 0 ? (state.bounds.x !== void 0 ? state.bounds.x: undefined) : undefined,
            y       : state.bounds !== void 0 ? (state.bounds.y !== void 0 ? state.bounds.y: undefined) : undefined,
        });
        // and load the index.html of the app.
        this._window.loadURL(url.format({
            pathname: path.join(__dirname, `client/index.html`),
            protocol: 'file:',
            slashes: true
        }) + `#v${this._version}`);
        // Emitted when the window is closed.
        this._window.on('closed', this._onClose.bind(this));
        //Attach handler for state saving
        ['resize', 'move', 'close' ].forEach((event) => {
            this._window.on(event, this._stateSave.bind(this));
        });
        //Restore maximization
        if (state.isMaximized) {
            this._window.maximize();
        }
    }

    _stateSave(event){
        let state = {};
        state.isMaximized = this._window.isMaximized();
        if (!state.isMaximized) {
            // only update bounds if the window isn’t currently maximized
            state.bounds = this._window.getBounds();
        }
        this._storage.setItem('windowState', state);
    }

    _createServer(){
        let Server = require('./server/service.js');
    }

    _onClose(){
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        this._window = null
    }

    debug(){
        this._window.webContents.openDevTools();
    }

}

const starter = new Starter();

module.exports = {
    starter: starter,
    updater: updater
};

