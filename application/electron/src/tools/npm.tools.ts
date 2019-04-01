import { exec, ExecException } from 'child_process';
import * as path from 'path';
import * as util from 'util';
import { getOSEnvVars, whereIs } from './process.env';
import ServiceElectron from '../services/service.electron';

import Logger from './env.logger';

let npmEnvVariables: any;

export function install(target: string, npmPath?: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const logger = new Logger(`npm: ${path.basename(target)}`);
        logger.env(`Installation is started with: ${target}`);
        getEnvVariables().then((env) => {
            exec(`npm install --prefix ${target}`, {
                env: env as any,
                cwd: target,
            }, (error: ExecException | null, stdout: string, stderr: string) => {
                logger.env(stderr);
                logger.env(stdout);
                if (error) {
                    logger.error(`Installation is failed due error: ${error.message}`);
                    return reject(error);
                }
                logger.error(`Installation is successful`);
                resolve();
            });
        });
    });
}

function getEnvVariables(): Promise<{ [key: string]: string | number | boolean }> {
    return new Promise((resolve) => {
        if (npmEnvVariables !== undefined) {
            return resolve(npmEnvVariables);
        }
        getOSEnvVars(true).then((env) => {
            const logger = new Logger(`NPM env detector`);
            Promise.all([whereIs('node'), whereIs('npm')]).then((values: Array<string | undefined>) => {
                if (npmEnvVariables !== undefined) {
                    return resolve(npmEnvVariables);
                }
                let PATH: string = env.PATH as string;
                values.forEach((location: string | undefined) => {
                    if (location !== undefined && PATH.indexOf(location) === -1) {
                        PATH = `${location}:${PATH}`;
                    }
                });
                if (typeof env.SHELL === 'string' && env.SHELL.trim() !== '') {
                    const shellPath: string = path.dirname(env.SHELL);
                    if (shellPath !== undefined && PATH.indexOf(shellPath) === -1) {
                        PATH = `${shellPath}:${PATH}`;
                    }
                }
                env.PATH = PATH;
                npmEnvVariables = Object.assign({
                    npm_config_target           : ServiceElectron.getVersion() as string,
                    npm_config_arch             : 'x64',
                    npm_config_target_arch      : 'x64',
                    npm_config_disturl          : 'https://atom.io/download/electron',
                    npm_config_runtime          : 'electron',
                    npm_config_build_from_source: 'true',
                    ELECTRON_RUN_AS_NODE        : '1',
                }, env);
                logger.env(`detected: ${util.inspect(npmEnvVariables)}`);
                resolve(npmEnvVariables);
            });
        });
    });
}
