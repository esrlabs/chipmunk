import { Field } from '../../../../common/settings/field';
import ServicePath from '../service.paths';

export class CoreIndex extends Field<string> {

    public getDefault(): string {
        return `client/index.html`;
    }

    public getOptions(): string[] {
        return [];
    }

    public getValidateErrorMessage(path: string): Error | undefined {
        const clientPath = ServicePath.resoveRootFolder(path);
        if (!ServicePath.isExist(clientPath)) {
            return new Error(`Cannot find client on path "${clientPath}"`);
        }
        return undefined;
    }

}
