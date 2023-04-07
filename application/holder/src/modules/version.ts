import * as fs from 'fs';
import * as path from 'path';

import { Module } from './module';
import { paths } from '@service/paths';
import { error } from 'platform/log/utils';

export interface IPackageFile {
    version: string;
    [key: string]: unknown;
}

export class Version extends Module {
    protected json!: IPackageFile;

    public getName(): string {
        return 'Version';
    }

    public override init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const packageJsonFile = path.resolve(paths.getRoot(), 'package.json');
            if (!fs.existsSync(packageJsonFile)) {
                return reject(new Error(`Fail to find ${packageJsonFile}`));
            }
            fs.promises
                .readFile(packageJsonFile, { encoding: 'utf-8' })
                .then((content: string) => {
                    try {
                        this.json = JSON.parse(content);
                    } catch (err) {
                        return reject(new Error(error(err)));
                    }
                    resolve();
                })
                .catch(reject);
        });
    }

    public getVersion(): string {
        return this.json.version;
    }
}

export const version: Version = new Version();
