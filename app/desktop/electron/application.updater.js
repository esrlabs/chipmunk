const electronUpdater   = require("electron-updater");
const util              = require('util');
const logger            = new (require('../server/libs/tools.logger'))('Electron');

const UPDATER_EVENTS = {
    CHECKING        : 'checking-for-update',
    AVAILABLE       : 'update-available',
    NOT_AVAILABLE   : 'update-not-available',
    PROGRESS        : 'download-progress',
    DOWNLOADED      : 'update-downloaded',
    ERROR           : 'error'
};


class Updater {

    constructor() {
        this._ServerEmitter                 = require('../server/libs/server.events');
        this._outgoingWSCommands            = require('../server/libs/websocket.commands.processor.js');
        this._autoUpdater                   = electronUpdater.autoUpdater;
        this._info                          = null;
        this._autoUpdater.logger            = logger;
        Object.keys(UPDATER_EVENTS).forEach((key) => {
            this._autoUpdater.on(UPDATER_EVENTS[key], this[UPDATER_EVENTS[key]].bind(this));
        });
        logger.info('Updater is created');
    }

    [UPDATER_EVENTS.CHECKING]() {
        logger.info('Checking for update...');
    }

    [UPDATER_EVENTS.AVAILABLE](info) {
        logger.info('Update available.');
        this._info = info;
        this._ServerEmitter.emitter.emit(this._ServerEmitter.EVENTS.SEND_VIA_WS, '*', this._outgoingWSCommands.COMMANDS.UpdateIsAvailable, {
            info: info
        });
    }

    [UPDATER_EVENTS.NOT_AVAILABLE](info) {
        logger.info(`Update not available. Info: ${util.inspect(info)}.`);
    }

    [UPDATER_EVENTS.PROGRESS](progressObj) {
        let log_message = "Download speed: " + progressObj.bytesPerSecond;
        log_message = log_message + ' - Downloaded ' + parseInt(progressObj.percent) + '%';
        log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
        logger.info(log_message);
        this._ServerEmitter.emitter.emit(this._ServerEmitter.EVENTS.SEND_VIA_WS, '*', this._outgoingWSCommands.COMMANDS.UpdateDownloadProgress, {
            speed       : progressObj.bytesPerSecond,
            progress    : progressObj.percent,
            info        : this._info
        });
    }

    [UPDATER_EVENTS.DOWNLOADED]() {
        logger.info('Update downloaded; will install in 1 seconds');
        setTimeout(() => {
            this._autoUpdater.quitAndInstall();
        }, 1000);
    }

    [UPDATER_EVENTS.ERROR](error) {
        logger.info(`Error in auto-updater. Error: ${util.inspect(error)}`);
    }

    check(){
        logger.info('Start update checking.');
        this._autoUpdater.setFeedURL({
            provider        : "github",
            owner           : "esrlabs",
            repo            : "logviewer"
        });
        return this._autoUpdater.checkForUpdates();
    }

    force(cancellationToken){
        return this._autoUpdater.downloadUpdate(cancellationToken);
    }
}

module.exports = Updater;