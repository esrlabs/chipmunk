import { exec, ExecException } from 'child_process';
import * as path from 'path';
import { getShellEnvironment } from './process.env';
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
                logger.env(`Installation is successful`);
                resolve();
            });
        });
    });
}

function getEnvVariables(): Promise<{ [key: string]: string | number | boolean }> {
    return new Promise((resolve) => {
        const logger = new Logger(`NPM env detector`);
        if (npmEnvVariables !== undefined) {
            return resolve(npmEnvVariables);
        }
        getShellEnvironment().then((env) => {
            npmEnvVariables = Object.assign({
                npm_config_target           : ServiceElectron.getVersion() as string,
                npm_config_arch             : 'x64',
                npm_config_target_arch      : 'x64',
                npm_config_disturl          : 'https://atom.io/download/electron',
                npm_config_runtime          : 'electron',
                npm_config_build_from_source: 'true',
                ELECTRON_RUN_AS_NODE        : '1',
            }, env);
            resolve(npmEnvVariables);
        }).catch((error: Error) => {
            logger.error(`Fail to get OS env due error: ${error.message}`);
        });
    });
}
