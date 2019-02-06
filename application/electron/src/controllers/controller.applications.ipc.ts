import Logger from '../../platform/node/src/env.logger';
import ControllerApplicationAPI from './controller.applications.api';

export interface IAppDescription {
    id: string;
}

export interface IApp {
    api: ControllerApplicationAPI;
    desc: IAppDescription;
}

/**
 * @class ControllerApplicationIpc
 * @description Provides communication between application and plugins/extentions
 */

export default class ControllerApplicationIpc {

    private _logger: Logger = new Logger('ControllerApplicationIpc');
    private _apps: Map<string, IApp> = new Map();

    /**
     * Returns to application API object to provide access to main process and render
     * @param {IAppDescription} desc description of application
     * @returns {Promise<ControllerApplicationAPI>}
     */
    public getAPI(desc: IAppDescription): Promise<ControllerApplicationAPI> {
        return new Promise((resolve, reject) => {
            const errors: Error[] | undefined = this._validateAppDesc(desc);
            if (errors) {
                return reject(new Error(errors.map((e: Error) => e.message ).join('\n')));
            }
            if (this._apps.has(desc.id)) {
                return reject(new Error(this._logger.warn(`Attempt to get API by application, but application with id "${desc.id}" already has gotten API.`)));
            }
            // Create application API
            const api: ControllerApplicationAPI = new ControllerApplicationAPI();
            // Register application data
            this._apps.set(desc.id, {
                api: api,
                desc: desc,
            });
            // Delivery API to application
            resolve(api);
        });
    }

    /**
     * Checks application description and returns errors, if errors were found
     * @param {IAppDescription} desc description of application
     * @returns {Error[] | undefined}
     */
    private _validateAppDesc(desc: IAppDescription): Error[] | undefined {
        const errors: Error[] = [];
        if (typeof desc !== 'object' || desc === null) {
            errors.push(new Error(this._logger.warn(`Expected as description of application object: {IAppDescription}, but gotten: ${typeof desc}`)));
            return errors;
        }
        if (typeof desc.id !== 'string' || desc.id.trim() === '') {
            errors.push(new Error(this._logger.warn(`[IAppDescription][id]: Expected as id of application string: {string}, but gotten: ${typeof desc.id}`)));
        }
        return errors.length > 0 ? errors : undefined;
    }

}
