const Path = require('path');
const glob = require('glob');
const FileManager = require('../server/libs/tools.filemanager');
const pathSettings = require('../server/libs/tools.settings.paths');

const ERRORS = {
	noParameter: 'noParameter',
	doubleParameter: 'doubleParameter',
	wrongParameter: 'wrongParameter',
	singleParameter: 'singleParameter',
	usedWith: 'usedWith',
	notWith: 'notWith'
};

const COMMANDS = {
	open  	: 'open',
	filter	: 'filter',
	sort	: 'sort',
	dest 	: 'dest',
	help    : 'help',
	debug 	: 'debug'
};

const ARGUMENTS = {
	[COMMANDS.open]  	: {
		description		: 'Open file(s). This is default command and can be skipped',
		hasParameter	: true,
		singleParameter : false,
		args			: ['-o', '--open'],
		errors			: {
			[ERRORS.noParameter]: 'Key "-o" (--open) expected file name(s) after.'
		}
	},
	[COMMANDS.filter]  	: {
		description		: 'Regular expression for filtering files. Example, --filter ".*\\d\\.txt$" will filter all *.txt files, which have one digit on the end.',
		hasParameter	: true,
		singleParameter : true,
		args			: ['-f', '--filter'],
		usedWith 		: [COMMANDS.open],
		errors			: {
			[ERRORS.noParameter]: 'Key "-f" (--filter) expected regular expression after. Example, --filter ".*\\d\\.txt".',
			[ERRORS.doubleParameter]: 'Key "-f" (--filter) can not be defined twice.',
			[ERRORS.singleParameter]: 'Key "-f" (--filter) supports only one parameter.',
			[ERRORS.usedWith]: 'Key "-f" (--filter) can be used only with commands -o (--open).'
		}
	},
	[COMMANDS.sort]    	: {
		description		: 'Definition of ordering of merging files. Available values: \n\t\tname\t\t- sort by name, \n\t\tnumbers\t\t- sort by numbers in file name, \n\t\tcreated\t\t- sort by creating date, \n\t\tmodified\t- sort by modification date.',
		hasParameter	: true,
		singleParameter : true,
		args			: ['-s', '--sort'],
		parameters		: ['name', 'numbers', 'created', 'modified'],
		usedWith 		: [COMMANDS.open],
		errors			: {
			[ERRORS.noParameter]: 'Key "-s" (--sort) expected type of sort after. Available values: name, numbers, created, modified.',
			[ERRORS.doubleParameter]: 'Key "-s" (--sort) can not be defined twice.',
			[ERRORS.wrongParameter]: 'Key "-s" (--sort) expected one of types of sort: "name", "numbers", "created", "modified".',
			[ERRORS.singleParameter]: 'Key "-s" (--sort) supports only one parameter.',
			[ERRORS.usedWith]: 'Key "-s" (--sort) can be used only with commands -o (--open).'
		}
	},
	[COMMANDS.dest]  	: {
		description		: 'To make concat operation without opening logviewer and save result to defined destination',
		hasParameter	: true,
		singleParameter : true,
		args			: ['-d', '--dest'],
		usedWith 		: [COMMANDS.open],
		errors			: {
			[ERRORS.noParameter]: 'Key "-d" (--dest) expected regExp after.',
			[ERRORS.doubleParameter]: 'Key "-d" (--dest) can not be defined twice.',
			[ERRORS.singleParameter]: 'Key "-d" (--dest) supports only one parameter.',
			[ERRORS.usedWith]: 'Key "-d" (--dest) can be used only with commands -o (--open).'
		}
	},
	[COMMANDS.help]    	: {
		description		: 'Show this message',
		hasParameter	: false,
		args			: ['-h', '--help'],
		errors			: {}
	},
	[COMMANDS.debug]  	: {
		description		: 'Open logviewer in debug mode',
		hasParameter	: false,
		args			: ['-deb', '--debug'],
		errors			: {}
	}
};

class CommandsImplementation{

	constructor(commands) {
		this.commands = commands;
		this.path = Path.dirname(process.mainModule.filename);
		this.fileManager = new FileManager(true);
	}

	proceed(){
		return new Promise((resolve, reject) => {
			if (~Object.keys(this.commands).indexOf(COMMANDS.help)){
				this.help();
				return resolve(true);
			}
			if (!~Object.keys(this.commands).indexOf(COMMANDS.open)){
				console.log(`Command -o (--open) isn't defined`);
				return resolve(false);
			}
			if (!this.checkFilter()){
				console.log(`Cannot created regular expression from defined filter.`);
				return resolve(false);
			}
			const patterns = this.commands[COMMANDS.open];
			this.getFilesList(patterns)
				.then((results) => {
					let files = [];
					results.forEach((_files) => {
						files.push(..._files);
					});
					files = this.filter(files);
					files = this.sort(files);
					if (files instanceof Error) {
						return reject(files);
					}
					if (files.length === 0) {
						console.log(`No files match with provided conditions.`);
						return resolve(false);
					}
					this.makeOutput(files)
						.then((dest) => {
							console.log(`\nCreated output file: ${dest}.\n`);
							resolve(dest);
						})
						.catch((error) => {
							reject(error);
						});
				})
				.catch((error) => {
					reject(error);
				});
		});
	}

	help() {
		console.log(`Supported commands: \n${Object.keys(ARGUMENTS).map((command)=>{
			let description = ARGUMENTS[command];
			return `${description.args.join(' | ')}\t-\t${description.description};`;
		}).join('\n')}`);
	}

	getFilesList(patterns){
		return Promise.all(patterns.map((pattern) => {
			return new Promise((resolve, reject) => {
				if (!glob.hasMagic(pattern)) {
					if (this.fileManager.isExistsSync(pattern)) {
						resolve([pattern]);
					} else {
						reject(new Error(`Cannot find file ${pattern} or used wrong pattern.`));
					}
				} else {
					glob(pattern, (error, files) => {
						if (error){
							return reject(error);
						}
						resolve(files instanceof Array ? files : []);
					});
				}
			});
		}));
	}

	checkFilter(){
		const filter = this.commands[COMMANDS.filter] !== void 0 ? this.commands[COMMANDS.filter][0] : false;
		if (!filter) {
			return true;
		}
		try {
			const regExp = new RegExp(filter, 'gi');
		} catch (e) {
			return false;
		}
		return true;
	}

	filter(files){
		const filter = this.commands[COMMANDS.filter] !== void 0 ? this.commands[COMMANDS.filter][0] : false;
		if (!filter) {
			return files;
		}
		const regExp = new RegExp(filter, 'gi');
		return files.filter((file) => {
			return Path.basename(file).search(regExp) !== -1;
		});
	}

	sort(files){
		const sorting = this.commands[COMMANDS.sort] !== void 0 ? this.commands[COMMANDS.sort][0] : false;
		if (!sorting) {
			return files;
		}
		let results = null;
		switch (sorting) {
			case 'name':
				results = this.fileManager.sort(files, this.fileManager.SORT_CONDITIONS.byName);
				break;
			case 'created':
				results = this.fileManager.sort(files, this.fileManager.SORT_CONDITIONS.byCreateDate);
				break;
			case 'numbers':
				results = this.fileManager.sort(files, this.fileManager.SORT_CONDITIONS.byNumbersInName);
				break;
			case 'modified':
				results = this.fileManager.sort(files, this.fileManager.SORT_CONDITIONS.byModificationDate);
				break;
		}
		return results;
	}

	makeOutput(files){
		return new Promise((resolve, reject) => {
			let dest;
			if (this.commands[COMMANDS.dest] !== void 0) {
				dest = this.commands[COMMANDS.dest][0];
			} else {
				dest = Path.join(pathSettings.DOWNLOADS, `${(new Date()).getTime()}.concat.txt`);
			}
			this.fileManager.glueFiles(files, dest, '\n')
				.then(() => {
					resolve(dest);
				})
				.catch(reject);
		});
	}

}

class CLIProcessor{

	constructor(isElectron = false){
		this.errors = [];
		this.commands = [];
		this.implementation = null;
		this.isElectron = isElectron;
	}

	isItArgument(smth) {
		let result = false;
		Object.keys(ARGUMENTS).forEach((command) => {
			let description = ARGUMENTS[command];
			description.args.forEach((_arg)=>{
				if (smth === _arg){
					result = true;
				}
			});
		});
		return result;
	}

	getParameters(index){
		let params = [];
		do {
			if (index > process.argv.length - 1 || process.argv[index] === void 0) {
				break;
			}
			if (this.isItArgument(process.argv[index])){
				break;
			}
			if (process.argv[index].trim() === '') {
				index += 1;
				continue;
			}
			params.push(process.argv[index]);
			index += 1;
		} while(true);
		return params;
	}

	getFirstArgumentIndex(){
		if (!(process.argv instanceof Array)) {
			return -1;
		}
		if (this.isElectron) {
			return 1;
		}
		const filename = Path.basename(process.mainModule.filename);
		let index = -1;
		process.argv.forEach((arg, i) => {
			if (index !== -1) {
				return;
			}
			const _filename = Path.basename(arg);
			if (_filename === filename) {
				index = i;
			}
		});
		return process.argv[index + 1] !== void 0 ? index + 1 : -1;
	}

	getDefaultParameters(){
		let index = this.getFirstArgumentIndex();
		const params = [];
		if (index === -1) {
			return params;
		}
		do {
			if (process.argv[index] === void 0) {
				break;
			}
			if (this.isItArgument(process.argv[index])) {
				break;
			}
			params.push(process.argv[index]);
			index += 1;
		} while(true);
		return params;
	}

	proceed(){
		return new Promise((resolve, reject) => {
			if (!(process.argv instanceof Array)) {
				return resolve(false);
			}
			let commands = {};
			let error = false;
			try {
				process.argv.forEach((arg, index) => {
					Object.keys(ARGUMENTS).forEach((command) => {
						let description = ARGUMENTS[command];
						description.args.forEach((_arg) => {
							if (_arg === arg) {
								if (description.hasParameter) {
									const params = this.getParameters(index + 1);
									if (params.length === 0) {
										console.log(description.errors[ERRORS.noParameter]);
										throw ERRORS.noParameter;
									}
									if (description.singleParameter && params.length > 1) {
										console.log(description.errors[ERRORS.singleParameter]);
										throw ERRORS.noParameter;
									}
									if (description.parameters instanceof Array){
										params.forEach((param) => {
											if (!~description.parameters.indexOf(param)){
												console.log(description.errors[ERRORS.wrongParameter]);
												throw ERRORS.wrongParameter;
											}
										});
									}
									commands[command] = params;
								} else {
									commands[command] = false;
								}
							}
						});
					});
				});
			} catch (e) {
				if (typeof e !== 'string') {
					throw e;
				} else {
					error = true;
				}
			}

			if (error) {
				return reject();
			}

			const defaults = this.getDefaultParameters();
			if (Object.keys(commands).length === 0 && defaults.length === 0) {
				return resolve(true);
			}

			//Check defaults
			if (Object.keys(commands).indexOf(COMMANDS.open) !== -1 && defaults.length > 0) {
				console.log(`File(s) sources should be defined at the beginning or after -o (--open) command.`);
				return reject();
			}

			if (Object.keys(commands).indexOf(COMMANDS.open) === -1 && defaults.length > 0) {
				commands[COMMANDS.open] = defaults;
			}

			//Check for conflicts
			Object.keys(commands).forEach((command) => {
				if (error) {
					return;
				}
				const description = ARGUMENTS[command];
				if (description.notWith instanceof Array){
					description.notWith.forEach((required) => {
						if (commands[required] !== void 0) {
							error = true;
							return console.log(description.errors[ERRORS.notWith]);
						}
					});
				}
				if (description.usedWith instanceof Array) {
					description.usedWith.forEach((required) => {
						if (commands[required] === void 0) {
							error = true;
							return console.log(description.errors[ERRORS.usedWith]);
						}
					});
				}
			});

			if (error) {
				return reject();
			}

			this.commands = commands;
			this.implementation = new CommandsImplementation(commands);

			this.implementation.proceed()
				.then((result) => {
					if (typeof result === 'string' && this.commands[COMMANDS.dest] !== void 0) {
						return resolve(false);
					}
					if (typeof result === 'string') {
						return resolve(result);
					}
					resolve(false);
				})
				.catch((e) => {
					reject(e);
				});
		});
	}

}

module.exports = CLIProcessor;