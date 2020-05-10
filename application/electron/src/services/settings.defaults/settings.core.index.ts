import { Field } from '../../../../common/settings/field.store';
import { ElementRefs } from '../../../../common/settings/field.render';
import ServicePath from '../service.paths';

export class CoreIndex extends Field<string> {

    public getDefault(): Promise<string> {
        return new Promise((resolve) => {
            resolve('client/index.html');
        });
    }

    public validate(path: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const clientPath = ServicePath.resoveRootFolder(path);
            if (!ServicePath.isExist(clientPath)) {
                return reject(new Error(`Cannot find client on path "${clientPath}"`));
            }
            resolve();
        });
    }

    public getElement(): undefined {
        return undefined;
    }

}
