import * as NPM from "npm";
import * as Path from "path";
import Emitter from "../platform/cross/src/emitter";

type TPackageJSON = { [key: string]: any };

export default class NPMInstaller extends Emitter {

    public static Events = {
        error   : Symbol(),
        logs    : Symbol(),
        success : Symbol(),
    };

    constructor() {
        super();
        // Bind NPM events
        this._bindNPM();
    }

    public destroy(): void {
        this._unbindNPM();
    }

    public install(
        folder: string,
        config: { [key: string]: any } = {},
        packages: { [key: string]: any } = {},
        node: boolean = false): Promise<void> {

        return new Promise((resolve, reject) => {
            this._getPackageFile(Path.normalize(folder)).then((description: TPackageJSON) => {
                // Check dependencies section
                if (typeof description.dependencies !== 'object' || description.dependencies === null || Object.keys(description.dependencies).length === 0) {
                    // If node installation isn't required - resolve
                    if (!node) {
                        this.emit(NPMInstaller.Events.logs, `Nothing to install for "${folder}".`);
                        return resolve();
                    }
                    // Overwrite dependencies as empty
                    description.dependencies = {};
                }
                // Add extra dependencies
                Object.keys(packages).forEach((name: string) => {
                    if (description.dependencies[name] === void 0) {
                        description.dependencies[name] = packages[name];
                    }
                });
                // Get dependencies list
                const brokenDependencies: string[] = [];
                const dependencies: string[] = Object.keys(description.dependencies).map((name: string) => {
                    if (typeof description.dependencies[name] !== 'string' || description.dependencies[name].trim() === '') {
                        brokenDependencies.push(name);
                        return '';
                    }
                    return `${name}@${description.dependencies[name]}`;
                });
                // Check dependencies for errors
                if (brokenDependencies.length > 0) {
                    return this._reject(new Error(`Fail to install because next dependencies are defined incorrectly: "${brokenDependencies.join(', ')}"`), reject);
                }
                // Save parent project's folder
                const originalCWD = process.cwd();
                // Update envirement paths
                process.env.PATH += `:${Path.normalize(folder + '/node_modules/.bin')}`;
                // Change folder
                this.emit(NPMInstaller.Events.logs, `Change folder to project folder: "${folder}".`);
                process.chdir(folder);
                // Load npm
                this.emit(NPMInstaller.Events.logs, `Loading NPM.`);
                NPM.load(Object.assign(config, this._getNPMConfiguration(folder)), (error: any) => {
                    if (error instanceof Error) {
                        this.emit(NPMInstaller.Events.logs, `Fail to load NPM due error: "${error.message}".`);
                        return this._reject(error, reject);
                    }
                    this.emit(NPMInstaller.Events.logs, `NPM is load successfully.`);
                    // Install node if needed
                    const nodePackages = [
                        `node@${process.versions.node}`,
                        `node-gyp`,
                    ];
                    (new Promise((resolveNodeInstallation, rejectNodeInstallation) => {
                        if (node) {
                            this._installPackages(nodePackages).then((results) => {
                                this.emit(NPMInstaller.Events.logs, `Installation of node is complited.`);
                                resolveNodeInstallation(results);
                            }).catch(rejectNodeInstallation);
                        } else {
                            return resolveNodeInstallation();
                        }
                    })).then(() => {
                        if (dependencies.length === 0) {
                            this.emit(NPMInstaller.Events.logs, `Installation of "${folder}" is complited.`);
                            return resolve();
                        }
                        // Install application
                        this._installPackages(dependencies).then(() => {
                            this.emit(NPMInstaller.Events.logs, `Installation of "${folder}" is complited.`);
                            resolve();
                        }).catch((errorAppInstallation: Error) => {
                            this._reject(errorAppInstallation, reject);
                        });
                    }).catch((nodeErrorInstallation: Error) => {
                        this.emit(NPMInstaller.Events.logs, `Fail to install packages (${nodePackages.join(', ')}) due error: "${nodeErrorInstallation.message}".`);
                        return this._reject(nodeErrorInstallation, reject);
                    });
                });
            }).catch((error: Error) => {
                return reject(error);
            });
        });
    }

    private _installPackages(packages: string[]): Promise<any> {
        return new Promise((resolve, reject) => {
            NPM.commands.install(packages, (error: Error | undefined, ...results: any[]) => {
                if (error instanceof Error) {
                    return reject(error);
                }
                resolve(results);
            });
        });
    }

    private _bindNPM(): void {
        NPM.on('log', (message: string) => {
            this.emit(NPMInstaller.Events.logs, message);
        });
        NPM.on('error', (error: Error) => {
            this.emit(NPMInstaller.Events.error, error);
        });
    }

    private _unbindNPM(): void {
        NPM.removeAllListeners('log');
        NPM.removeAllListeners('error');
    }

    private _getNPMConfiguration(projectFolder: string): { [key: string]: any } {
        return {
            'bin-links': true,
            'prefix': projectFolder,
            'scripts-prepend-node-path': true,
            'verbose': true,
        };
    }

    private _getPackageFile(packageFile: string): Promise<TPackageJSON> {
        return new Promise((resolve, reject) => {
            import(Path.normalize(packageFile + "/package.json")).then((description: TPackageJSON) => {
                if (typeof description !== 'object' || description === null) {
                    return this._reject(new Error(`Fail to find "package.json" file.`), reject);
                }
                if (typeof description.name !== 'string') {
                    return this._reject(new Error(`Incorrect format of "package.json" file.`), reject);
                }
                resolve(description);
            }).catch((error: Error) => {
                return this._reject(error, reject);
            });
        });
    }

    private _reject(error: Error, reject: (error: Error) => void): void {
        this.emit(NPMInstaller.Events.logs, error.message);
        this.emit(NPMInstaller.Events.error, error);
        return reject(error);
    }

}
