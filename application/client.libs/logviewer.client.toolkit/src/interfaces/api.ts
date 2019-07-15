import * as Components from './components';
import * as Enums from '../consts/enums';
import { Observable } from 'rxjs-compat';

export interface IAPI {
    addOutputInjection: (injection: Components.IComponentInjection, type: Enums.EViewsTypes) => void;
    removeOutputInjection: (id: string, type: Enums.EViewsTypes) => void;
}