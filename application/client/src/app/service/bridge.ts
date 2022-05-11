import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { File, FileType } from '@platform/types/files';
import { StatisticInfo, IDLTOptions } from '@platform/types/parsers/dlt';

import * as Events from '@platform/ipc/event/index';
import * as Requests from '@platform/ipc/request/index';

@SetupService(services['bridge'])
export class Service extends Implementation {
    public files(): {
        select: {
            any(): Promise<File[]>;
            dlt(): Promise<File[]>;
            pcap(): Promise<File[]>;
            text(): Promise<File[]>;
            custom(ext: string): Promise<File[]>;
        };
    } {
        const request = (target: FileType, ext?: string): Promise<File[]> => {
            return new Promise((resolve, reject) => {
                Requests.IpcRequest.send(
                    Requests.File.Select.Response,
                    new Requests.File.Select.Request({
                        target,
                        ext,
                    }),
                )
                    .then((response) => {
                        resolve(response.files);
                    })
                    .catch(reject);
            });
        };
        return {
            select: {
                any: (): Promise<File[]> => {
                    return request(FileType.Any);
                },
                dlt: (): Promise<File[]> => {
                    return request(FileType.Dlt);
                },
                pcap: (): Promise<File[]> => {
                    return request(FileType.Pcap);
                },
                text: (): Promise<File[]> => {
                    return request(FileType.Text);
                },
                custom: (ext: string): Promise<File[]> => {
                    return request(FileType.Any, ext);
                },
            },
        };
    }

    public dlt(): {
        stat(filename: string): Promise<StatisticInfo>;
    } {
        return {
            stat: (filename: string): Promise<StatisticInfo> => {
                return new Promise((resolve, reject) => {
                    Requests.IpcRequest.send(
                        Requests.Dlt.Stat.Response,
                        new Requests.Dlt.Stat.Request({
                            filename,
                        }),
                    )
                        .then((response) => {
                            resolve(response.stat);
                        })
                        .catch(reject);
                });
            },
        };
    }
}
export interface Service extends Interface {}
export const bridge = register(new Service());
