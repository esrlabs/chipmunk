import { exec, ExecException } from 'child_process';
import * as path from 'path';
import ServiceElectron from '../services/service.electron';
import Logger from '../../platform/node/src/env.logger';

export function install(target: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const logger = new Logger(`npm: ${path.basename(target)}`);
        logger.env(`Installation is started with: ${target}`);
        exec(`npm install --prefix ${target}`, { env: Object.assign({
            npm_config_target: ServiceElectron.getVersion() as string,
            npm_config_arch: 'x64',
            npm_config_target_arch: 'x64',
            npm_config_disturl: 'https://atom.io/download/electron',
            npm_config_runtime: 'electron',
            npm_config_build_from_source: 'true',
        }, process.env)}, (error: ExecException | null, stdout: string, stderr: string) => {
            logger.env(stderr);
            logger.env(stdout);
            if (error) {
                logger.error(`Fail to install due error: ${error.message}`);
                return reject(error);
            }
            logger.env(`Installation is complite.`);
            resolve();
        });
    });
}
