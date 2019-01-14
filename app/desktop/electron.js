const { app, BrowserWindow } = require('electron');
const path              = require('path');
const url               = require('url');
const Updater           = require('./electron/application.updater.direct');
const ApplicationMenu   = require('./electron/application.menu');
const ApplicationStorage= require('./electron/application.storage');
const ApplicationCLI 	= require('./electron/application.cli');
const logger            = new (require('./server/libs/tools.logger'))('Electron');
const updater 			= new Updater();

const ELECTRON_EVENTS = {
	READY: 'ready',
	WINDOW_ALL_CLOSED: 'window-all-closed',
	ACTIVATE: 'activate'
};

class Starter {

	constructor(){
		this._app               = app;
		this._window            = null;
		this._ready             = false;
		this._storage 			= null;
		this._menu 				= null;
		this._version 			= null;
		this._cli 				= new ApplicationCLI(this._app.getVersion(), true);
		this._state 			= {};
		this._stateSave 		= this._stateSave.bind(this);
		//Bind electron events
		Object.keys(ELECTRON_EVENTS).forEach((key) => {
			if (this[ELECTRON_EVENTS[key]] !== void 0){
				this[ELECTRON_EVENTS[key]] = this[ELECTRON_EVENTS[key]].bind(this);
				this._app.on(ELECTRON_EVENTS[key], this[ELECTRON_EVENTS[key]]);
			}
		});
	}

	_init(){
		this._storage 	= new ApplicationStorage();
		this._version 	= this._app.getVersion();
		this._menu 		= new ApplicationMenu();
	}

	// initialization and is ready to create browser windows.
	// Some APIs can only be used after this event occurs.
	[ELECTRON_EVENTS.READY](){
		//Check CLI
		this._cli.proceed()
			.then((result) => {
				if (typeof result === 'string' || result === true) {
					this._loadFile(result);
					this._init();
					this._create();
					this._menu.create();
					this._ready = true;
					return;
				}
				if (!result) {
					return this._app.quit();
				}
			})
			.catch((e)=>{
				if (e instanceof Error) {
					console.log(`Cannot start logviewer due error: ${e.message}.`);
				}
				this._app.quit();
			});
	}

	// Quit when all windows are closed.
	[ELECTRON_EVENTS.WINDOW_ALL_CLOSED](){
		// On OS X it is common for applications and their menu bar
		// to stay active until the user quits explicitly with Cmd + Q
		if (process.platform !== 'darwin') {
			this._app.quit();
		}
	}

	[ELECTRON_EVENTS.ACTIVATE](){
		// On OS X it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		this._ready && this._create();
	}

	_create(){
		if (this._window === null) {
			this._initClient();
			this._createServer();
		}
	}

	_initClient(){
		this._storage.get()
			.then((state) => {
				this._createClient(state);
			})
			.catch((error) => {
				logger.error(`State getting error due error: ${error.message}.`);
				this._createClient({});
			});
	}

	_createClient(state){
		// Create the browser window.
		this._state = {
			title   : `LogViewer@${this._version}`,
			width   : state.bounds !== void 0 ? (state.bounds.width !== void 0 ? state.bounds.width: 850) : 850,
			height  : state.bounds !== void 0 ? (state.bounds.height !== void 0 ? state.bounds.height: 600) : 600,
			x       : state.bounds !== void 0 ? (state.bounds.x !== void 0 ? state.bounds.x: undefined) : undefined,
			y       : state.bounds !== void 0 ? (state.bounds.y !== void 0 ? state.bounds.y: undefined) : undefined,
		};
		this._window = new BrowserWindow(Object.assign({ webPreferences: {
			devTools: true
		}}, this._state));
		// and load the index.html of the app.
		this._window.loadURL(url.format({
			pathname: path.join(__dirname, `client/index.html`),
			protocol: 'file:',
			slashes: true
		}) + `#v${this._version}`);
		//this._window.loadFile(path.join(__dirname, `client/index.html`));
		// Emitted when the window is closed.
		this._window.on('closed', this._onClose.bind(this));
		//Attach handler for state saving
		['resize', 'move', 'close' ].forEach((event) => {
			this._window.on(event, this._stateSave);
		});
		//Restore maximization
		if (state.isMaximized) {
			this._window.maximize();
		}
		//Debug activation
		if (process.argv instanceof Array && process.argv.indexOf('--debug') !== -1) {
			this.debug();
		}
	}

	_stateSave(event){
		this._state.isMaximized = this._window.isMaximized();
		if (!this._state.isMaximized) {
			// only update bounds if the window isn’t currently maximized
			this._state.bounds = this._window.getBounds();
		}
		this._storage.set(this._state)
			.then(() => {
				logger.debug(`State is saved`);
			})
			.catch((e) => {
				logger.debug(`Fail save state due error: ${e.message}`);
			});
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

	_loadFile(file){
		if (typeof file !== 'string' || file.trim() === '') {
			return false;
		}
		const ServerEmitter = require('./server/libs/server.events');
		const outgoingWSCommands = require('./server/libs/websocket.commands.processor.js');
		ServerEmitter.emitter.on(ServerEmitter.EVENTS.CLIENT_IS_CONNECTED, (GUID, clientGUID) => {
			ServerEmitter.emitter.emit(ServerEmitter.EVENTS.SEND_VIA_WS, clientGUID, outgoingWSCommands.COMMANDS.OpenLocalFile, {
				file: file
			});
			ServerEmitter.emitter.removeAllListeners(ServerEmitter.EVENTS.CLIENT_IS_CONNECTED);
		});
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

