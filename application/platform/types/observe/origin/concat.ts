import { error } from '../../../log/utils';
import { Configuration as Base, ConfigurationStaticDesc } from '../configuration';
import { OriginDetails, IOriginDetails, IList, Job, IJob, OriginType } from '../description';
import { Configuration as ConfigurationFile } from './file';
import { Context, SourceUuid, IConfiguration as IOriginConfiguration } from './index';
import { basefolder } from '../../../env/str';
import { Statics } from '../../../env/decorators';
import { unique } from '../../../env/sequence';

import * as Types from '../types';
import * as Parser from '../parser';
import * as Sde from '../sde';
import * as str from '../../../env/str';

export type IConfiguration = [SourceUuid, Types.File.FileType, Types.File.FileName][];

@Statics<ConfigurationStaticDesc<IConfiguration, Context>>()
export class Configuration
    extends Base<IConfiguration, Configuration, Context>
    implements OriginDetails, Sde.Support, Parser.Support, Job
{
    static desc(): IList {
        return {
            major: `Files`,
            minor: 'Local Files',
            icon: 'files',
        };
    }

    static alias(): Context {
        return Context.Concat;
    }

    static validate(configuration: IConfiguration): Error | IConfiguration {
        try {
            if (!(configuration instanceof Array) || configuration.length === 0) {
                throw new Error(
                    `Source "${Context.Concat}" should be represented as a not empty array.`,
                );
            } else {
                configuration.forEach((file) => {
                    // If file settings are not correct it will throw an error
                    new ConfigurationFile(file, undefined);
                });
            }
            return configuration;
        } catch (e) {
            return new Error(error(e));
        }
    }

    // Gives initial settings. Not necessarily valid.
    static initial(): IConfiguration {
        return [];
    }

    protected defaultFileType: Types.File.FileType = Types.File.FileType.Text;

    public source(): string | undefined {
        return undefined;
    }

    public set(): {
        files(files: string[]): Configuration;
        defaults(type: Types.File.FileType): Configuration;
        push(filename: string, type: Types.File.FileType): Configuration;
        remove(filename: string): Configuration;
        alias(alias?: string): Configuration;
    } {
        return {
            files: (files: string[]): Configuration => {
                this.configuration.push(
                    ...(files.map((filename: string) => {
                        return [unique(), this.defaultFileType, filename];
                    }) as IConfiguration),
                );
                return this;
            },
            defaults: (type: Types.File.FileType): Configuration => {
                this.defaultFileType = type;
                return this;
            },
            push: (filename: string, type: Types.File.FileType): Configuration => {
                this.configuration.push([unique(), type, filename]);
                return this;
            },
            remove: (filename: string): Configuration => {
                const index = this.configuration.findIndex((def) => def[2] === filename);
                if (index !== -1) {
                    this.configuration.splice(index, 1);
                }
                return this;
            },
            alias: (alias?: string): Configuration => {
                this.configuration.forEach((file) => {
                    file[0] = alias === undefined ? unique() : alias;
                });
                return this;
            },
        };
    }

    public files(): string[] {
        return this.configuration.map((c) => c[2]);
    }

    public filetypes(): Types.File.FileType[] {
        return this.configuration.map((c) => c[1]);
    }

    public asFileOrigins(): IOriginConfiguration[] {
        return this.configuration.map((c) => {
            return {
                [Context.File]: c,
            };
        });
    }

    public desc(): IOriginDetails {
        const first = this.configuration[0];
        return {
            major: `Concating ${this.configuration.length} files`,
            minor: first !== undefined ? basefolder(first[2]) : '',
            icon: 'insert_drive_file',
            type: OriginType.file,
            action: 'Concat',
            state: {
                running: 'processing',
                stopped: '',
            },
        };
    }

    public asJob(): IJob {
        return {
            name: 'concating',
            desc: `concating ${this.configuration.length} files`,
            icon: 'insert_drive_file',
        };
    }

    public getSupportedParsers(): Parser.Reference[] {
        if (this.configuration.length === 0) {
            // Returns default
            return [
                Parser.Dlt.Configuration,
                Parser.SomeIp.Configuration,
                Parser.Text.Configuration,
            ];
        }
        switch (this.configuration[0][1]) {
            case Types.File.FileType.Binary:
                return [Parser.Dlt.Configuration, Parser.SomeIp.Configuration];
            case Types.File.FileType.PcapNG:
                return [Parser.Dlt.Configuration, Parser.SomeIp.Configuration];
            case Types.File.FileType.PcapLegacy:
                return [Parser.Dlt.Configuration, Parser.SomeIp.Configuration];
            case Types.File.FileType.Text:
                return [Parser.Text.Configuration];
        }
    }

    public override hash(): number {
        return str.hash(`${this.files().join(';')};${this.filetypes().join(';')}`);
    }
}
