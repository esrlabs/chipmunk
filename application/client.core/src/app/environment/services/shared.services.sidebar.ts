// List of services bellow is shared with each tab component (sidebar and secondary area)

import { IFileOpenerService } from './service.file.opener';
import { IMergeFilesService } from './service.file.merge';
import { IConcatFilesService } from './service.file.concat';

export { IFileOpenerService };

export interface IServicesHolder {
    FileOpenerService: IFileOpenerService | undefined;
    MergeFilesService: IMergeFilesService | undefined;
    ConcatFilesService: IConcatFilesService | undefined;
}

export interface IServices {
    FileOpenerService: IFileOpenerService;
    MergeFilesService: IMergeFilesService;
    ConcatFilesService: IConcatFilesService;
}

let shared: IServicesHolder = {
    FileOpenerService: undefined,
    MergeFilesService: undefined,
    ConcatFilesService: undefined,
};

export function setSharedServices(services: IServices) {
    shared = services as IServicesHolder;
}

export function getSharedServices(): IServices {
    if (
        shared.ConcatFilesService === undefined ||
        shared.MergeFilesService === undefined ||
        shared.FileOpenerService === undefined
    ) {
        throw new Error(`Shared services {IServices} aren't available. `);
    }
    return shared as IServices;
}
