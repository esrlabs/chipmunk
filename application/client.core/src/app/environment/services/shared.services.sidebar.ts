// List of services bellow is shared with each tab component (sidebar and secondary area)

import { IFileOpenerService, IFile } from './service.file.opener';

export { IFileOpenerService, IFile };

export interface IServices {
    FileOpenerService: IFileOpenerService;
}

let shared: IServices = {
    FileOpenerService: undefined
};

export function setSharedServices(services: IServices) {
    shared = services;
}

export function getSharedServices(): IServices {
    return shared;
}
