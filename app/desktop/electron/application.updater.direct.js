const path = require('path');
const fs = require('fs');
const { spawn, fork } = require('child_process');
const logger = new (require('../server/libs/tools.logger'))('UpdaterDirect');
const Connector = require('./application.github.connector');
const AppPaths = require('../server/libs/tools.settings.paths');

const RESOURCE_FILTERS = {
	darwin: /\.dmg$/gi,
	win32: /\.exe$/gi,
	freebsd: /\.appimage$/gi,
	linux: /\.appimage$/gi,
	openbsd: /\.appimage$/gi,
	sunos: /\.appimage$/gi,
	aix: /\.appimage$/gi,
};

class Updater {

	constructor() {
		this._ServerEmitter = require('../server/libs/server.events');
		this._outgoingWSCommands = require('../server/libs/websocket.commands.processor.js');
		this._connector = new Connector();
		this._lastRelease = null;
		this._canceled = false;
	}

	init(){
		logger.info('Updater is inited');
	}


	check(){
		return new Promise((resolve, reject) => {
			this._connector.getLastRelease().then((release) => {
				this._lastRelease = release;
				this._ServerEmitter.emitter.emit(this._ServerEmitter.EVENTS.SEND_VIA_WS, '*', this._outgoingWSCommands.COMMANDS.UpdateIsAvailable, {
					release: release
				});
				resolve(release);
			}).catch((error) => {
				reject(error);
			});
		});
	}

	update() {
		return new Promise((resolve, reject) => {
			logger.info(`Staring update`);
			if (this._lastRelease === null) {
				return resolve();
			}
			if (RESOURCE_FILTERS[process.platform] === void 0) {
				return reject(new Error(`Current platform isn't supported.`));
			}
			const targetURL = this._connector.getTargetURL(this._lastRelease.assets, RESOURCE_FILTERS[process.platform]);
			if (targetURL instanceof Error) {
				return reject(targetURL);
			}
			if (targetURL === null) {
				return reject(new Error(`Cannot detect target url to download update.`));
			}
			logger.info(`TargetURL: ${targetURL}`);
			const destFullFileName = this.getDestResourceFile(this._lastRelease.name);
			logger.info(`Destination file: ${destFullFileName}`);
			this._connector.download(targetURL, destFullFileName, (progress) => {
				this._ServerEmitter.emitter.emit(this._ServerEmitter.EVENTS.SEND_VIA_WS, '*', this._outgoingWSCommands.COMMANDS.UpdateDownloadProgress, {
					progress    : Math.floor((progress.done/progress.total) * 100),
					total      	: progress.total,
					done 		: progress.done,
					version 	: this._lastRelease.name
				});
				logger.info(`done: ${Math.floor((progress.done/progress.total) * 100)}%`);
			}).then((file) => {
				if (file === null) {
					// Download was canceled
					return;
				}
				logger.info(`An update is downloaded: ${destFullFileName}`);
				this.applyUpdate(destFullFileName, this._lastRelease.name).catch((error) => {
					reject(error);
				});
			}).catch((error) => {
				logger.error(`Fail to download an update due error: ${error.message}`);
			});
			// Resolve before downloading, because downloading could take too much time.
			resolve({
				file: destFullFileName,
				version: this._lastRelease.name
			});
		});
	}

	applyUpdate(file, version) {
		return new Promise((resolve, reject) => {
			this.getInstallerFile().then((installerFile) => {
				logger.info(`Installer script is ready: ${installerFile}`);
				const out = fs.openSync(path.normalize(path.resolve(path.dirname(file), `installation.${version}.log`)), 'a');
				const err = fs.openSync(path.normalize(path.resolve(path.dirname(file), `installation.err.${version}.log`)), 'a');
				const installer = fork(installerFile, [`file=${file}`, `version=${version}`], {
					cwd: path.dirname(installerFile),
					detached: true,
					silent:true,
					stdio: [ 'ignore', out, err, 'ipc' ]
				});
				logger.info(`Process is forked on: ${installerFile}.`);
				installer.disconnect();
				installer.unref();
				resolve();
				process.exit(0);
			}).catch((error) => {
				logger.error(`Fail to get installer file due error: ${error.message}`);
				reject(error);
			});
		});
	}

	getDestResourceFile(version) {
		switch(process.platform) {
			case 'darwin':
				return path.normalize(path.resolve(AppPaths.RELEASES, `logviewer.${version}.dmg`));
			case 'win32':
				return path.normalize(path.resolve(AppPaths.RELEASES, `logviewer.${version}.exe`));
			default: 
				return path.normalize(path.resolve(AppPaths.RELEASES, `logviewer.${version}.AppImage`));
		}
	}

	getInstallerSource() {
		switch(process.platform) {
			case 'darwin':
				return 'application.installer.darwin.js';
			case 'win32':
				return 'application.installer.windows.js';
			default: 
				return 'application.installer.linux.js';
		}
	}

	cancel() {
		this._connector.cancelDownload();
	}

	spawn(cwd, command, ...args){
		return new Promise((resolve, reject) => {
			const ls = spawn(command, [...args], {
				cwd: cwd,
				env: process.env
			});
	
			ls.stdout.on('data', (data) => {
				logger.info(this.outputToString(data));
			});
	
			ls.stderr.on('data', (data) => {
				logger.error(this.outputToString(data));
				reject(new Error(this.outputToString(data)));
			});
	
			ls.on('close', (code) => {
				resolve();
			});
		});
	}

	getInstallerFile() {
		return new Promise((resolve, reject) => {
			let target;
			if (typeof process.resourcesPath === 'string' && process.resourcesPath.trim() !== '') {
				target = require.resolve(`./${this.getInstallerSource()}`);
			} else {
				target = require.resolve(`./${this.getInstallerSource()}`);
			}
			logger.info(`Installer script: ${target}`);
			if (!fs.existsSync(target)) {
				return reject(new Error(`Cannot find installer script: ${target}`));
			}
			const dest = path.normalize(path.resolve(AppPaths.RELEASES, 'installer.js'));
			if (fs.existsSync(dest)) {
				fs.unlinkSync(dest);
			}
			try {
				// Read source file
				let buffer = fs.readFileSync(target);
				if (!(buffer instanceof Buffer)) {
					return reject(new Error(logger.error(`Error reading file ${target}`)));
				}
				// Write installer
				fs.writeFileSync(dest, buffer);
				resolve(dest);
			} catch (error) {
				reject(new Error(logger.error(`Fail to get current version of app due error: ${error.message}`)));
			}
		});
	}

	outputToString(smth) {
		if (typeof smth === 'string') {
			return smth;
		} else if (smth instanceof Buffer) {
			return smth.toString('utf8');
		} else if (smth !== null && smth !== undefined && typeof smth.toString === 'function') {
			return smth.toString();
		} else {
			return '';
		}
	}

}

module.exports = Updater;