import * as Path from 'path';

import { ChildProcess, spawn } from 'child_process';
import { StringDecoder } from 'string_decoder';
import { getOSEnvVars, TEnvVars } from './process.env';

import Emitter from '../../cross/src/emitter';

interface ISpawnParameters {
    command: string;
    options?: {[key: string]: any };
    getOriginalEnvVars?: string[];
    addToPath?: string;
    coding?: string;
}

export default class Spawn extends Emitter {

    public static Events = {
        close: Symbol(),
        disconnect: Symbol(),
        error: Symbol(),
        exit: Symbol(),
        message: Symbol(),
        stderr: Symbol(),
        stdout: Symbol(),
        stream: Symbol(), // Include data from stdout and stderr
    };

    private process: ChildProcess | null = null;
    private decoder: any = new StringDecoder();

    constructor() {
        super();
    }

    public execute(parameters: ISpawnParameters): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.process !== null) {
                return reject(`Previous process is still working.`);
            }
            this.getParameters(parameters).then((validParams: ISpawnParameters) => {
                const command: string = this.getCommand(validParams.command);
                const args: string[] = this.getCommandArgs(validParams.command);
                let task;
                try {
                    task = spawn(command, args, validParams.options);
                    // Check state of task
                    if (task === null) {
                        throw new Error(`Fail to execute command "${command}" with arguments "${args.join(' ')}"`);
                    }
                    if (typeof task.pid !== 'number' || task.pid <= 0) {
                        task.kill();
                        throw new Error(`Fail to execute command "${command}" with arguments "${args.join(' ')}". PID of instance is unknown.`);
                    }
                } catch (executeError) {
                    return reject(executeError);
                }
                // Seems command is executed. Attach listeners.
                this.process = task;
                // Data events
                task.stdout.on('data', (data: string) => {
                    this.emit(Spawn.Events.stdout, this.decode(data));
                    this.emit(Spawn.Events.stream, this.decode(data));
                });
                task.stderr.on('data', (data: string) => {
                    this.emit(Spawn.Events.stderr, this.decode(data));
                    this.emit(Spawn.Events.stream, this.decode(data));
                });
                // Error events
                task.on('error', (error: Error) => {
                    this.emit(Spawn.Events.error, error);
                    if (this.process !== null) { reject(error); }
                    this.process = null;
                });
                // State events
                task.on('close', (code: number, signal: string) => {
                    this.emit(Spawn.Events.close, code, signal);
                    if (this.process !== null) { resolve(); }
                    this.process = null;
                });
                task.on('exit', (code: number, signal: string) => {
                    this.emit(Spawn.Events.exit, code, signal);
                    if (this.process !== null) { resolve(); }
                    this.process = null;
                });
                task.on('message', (message: any, handler: () => void) => {
                    this.emit(Spawn.Events.message, message, handler);
                });
                task.on('disconnect', () => {
                    this.emit(Spawn.Events.disconnect);
                });
            }).catch((error: Error) => {
                reject(error);
            });
        });
    }

    public kill(signal: string = 'SIGTERM') {
        if (this.process === null) {
            return;
        }
        this.process.kill(signal);
        this.process = null;
    }

    private decode(input: any): string {
        if (typeof input === 'string') {
            return input;
        }
        try {
            return this.decoder.write(input);
        } catch (error) {
            return '';
        }
    }

    private getCommandArgs(command: string): string[] {
        const args: string[] = command.trim().split(' ').filter((part: string) => part.trim() !== '');
        args.splice(0, 1);
        return args;
    }

    private getCommand(command: string): string {
        const args: string[] = command.trim().split(' ').filter((part: string) => part.trim() !== '');
        return args[0];
    }

    private getParameters(parameters: ISpawnParameters): Promise<ISpawnParameters> {
        return new Promise((resolve, reject) => {
            // Validate paramters
            if (!(parameters.getOriginalEnvVars instanceof Array)   && parameters.getOriginalEnvVars    !== void 0  ) { return reject(new Error(`Expecting "getOriginalEnvVars" will be {string[]}.`)); }
            if (typeof parameters.addToPath !== 'string'            && parameters.addToPath             !== void 0  ) { return reject(new Error(`Expecting "addToPath" will be {string}.`)); }
            if (typeof parameters.options !== 'object'              && parameters.options               !== void 0  ) { return reject(new Error(`Expecting "options" will be {object}.`)); }
            if (typeof parameters.command !== 'string'                                                              ) { return reject(new Error(`Expecting "command" will be {string}.`)); }

            // Setup default parameters
            const results: ISpawnParameters = Object.assign({}, parameters);
            if (results.getOriginalEnvVars   === void 0) { results.getOriginalEnvVars = []; }
            if (results.addToPath            === void 0) { results.addToPath = ''; }
            if (results.options              === void 0) { results.options = {}; }

            // Check command for path
            const dirname = Path.dirname(results.command);
            if (dirname.trim() !== '.') {
                results.addToPath = results.addToPath !== '' ? `${results.addToPath}:${dirname}` : dirname;
            }
            // Add env
            if (results.options.env === void 0) {
                results.options.env = Object.assign({}, process.env);
            }

            // Set defaults
            if (results.options.stdio === void 0) {
                results.options.stdio = 'pipe';

            }

            // Add PATHs
            if (results.getOriginalEnvVars.length > 0) {
                return getOSEnvVars().then((envVars: TEnvVars) => {
                    // Inject env variables
                    (results.getOriginalEnvVars as string[]).forEach((variable: string) => {
                        if (typeof envVars[variable] === 'string') {
                            (results.options as any).env[variable] = envVars[variable];
                        }
                    });
                    // Inject addition PATHs
                    (results.options as any).env.PATH = `${results.addToPath}:${(results.options as any).env.PATH}`;
                    resolve(results);
                }).catch((error: Error) => {
                    reject(error);
                });
            }

            // Inject addition PATHs
            results.options.env.PATH = `${results.addToPath}:${results.options.env.PATH}`;

            // Resolve
            resolve(results);
        });
    }

}
