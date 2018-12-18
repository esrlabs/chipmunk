const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class Installer {

	constructor() {
		this.env = process.env; 
	}
    
    setParams() {
        this.file = null;
        this.version = null;
        if (!(process.argv instanceof Array) || process.argv.length < 2) {
            return;
        }
        this.file = process.argv[process.argv.length - 2];
        this.version = process.argv[process.argv.length - 1];
        if (this.file.indexOf('file=') === -1 || this.version.indexOf('version=') === -1) {
            this.file = null;
            this.version = null;
            return;
        }
        this.file = this.file.replace('file=', '');
		this.version = this.version.replace('version=', '');
		console.log(`file: ${this.file}\nversion:${this.version}`);
    }

    install() {
		return new Promise((resolve, reject) => {
            this.setParams();
            if (this.file === null || this.version === null) {
                return reject(`No file/version data is detected`);
			}
			this.spawn('.', 'chmod', 'a+x', this.file).then(() => {
				console.log('Starting installation');
				const out = fs.openSync(path.normalize(path.resolve(path.dirname(this.file), `installation.${this.version}.log`)), 'a');
				const err = fs.openSync(path.normalize(path.resolve(path.dirname(this.file), `installation.err.${this.version}.log`)), 'a');
				let child = spawn(this.file, {
					detached: true,
					stdio: [ 'ignore', out, err ]
				});
				child.unref();
				console.log(`Installation process is running`);
				resolve();
			}).catch((error) => {
				reject(error);
			});
		});
	}


    spawn(cwd, command, ...args){
		return new Promise((resolve, reject) => {
			const ls = spawn(command, [...args], {
				cwd: cwd,
				env: this.env
			});
			let output = '';
	
			ls.stdout.on('data', (data) => {
				console.log(this.outputToString(data));
				output += this.outputToString(data);
			});
	
			ls.stderr.on('data', (data) => {
				console.error(this.outputToString(data));
				reject(new Error(this.outputToString(data)));
			});
	
			ls.on('close', (code) => {
				resolve(output);
			});
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

// Start with timeout, because parent process should be closed
setTimeout(() => {
	const installer = new Installer();
	installer.install().then(() => {
		console.log(`Installation is complite`);
		process.exit();
	}).catch((error) => {
		console.error(`Fail to install due error: ${error.message}`);
	});
}, 2000);
