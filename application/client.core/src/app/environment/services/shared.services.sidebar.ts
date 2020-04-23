// List of services bellow is shared with each tab component (sidebar and secondary area)

import { IFileOpenerService, IFile } from './service.file.opener';
import { IMergeFilesService } from './service.file.merge';

export { IFileOpenerService, IFile };

export interface IServices {
    FileOpenerService: IFileOpenerService;
    MergeFilesService: IMergeFilesService;
}

let shared: IServices = {
    FileOpenerService: undefined,
    MergeFilesService: undefined,
};

export function setSharedServices(services: IServices) {
    shared = services;
}

export function getSharedServices(): IServices {
    return shared;
}
