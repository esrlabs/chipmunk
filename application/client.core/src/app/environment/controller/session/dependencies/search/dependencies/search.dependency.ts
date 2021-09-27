import { Session } from '../../../session';
import { ControllerSessionTabSearch } from '../controller.session.tab.search';
import { Dependency } from '../../session.dependency';

export type SessionGetter = () => Session;
export type SearchSessionGetter = () => ControllerSessionTabSearch;
export type SearchDependencyConstructor<T> = new (
    uuid: string,
    session: SessionGetter,
    search: SearchSessionGetter,
) => Dependency & T;

export { Dependency };
