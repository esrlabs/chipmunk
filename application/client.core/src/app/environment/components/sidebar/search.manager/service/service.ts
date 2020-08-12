import ToolbarSessionsService from '../../../../services/service.sessions.toolbar';

export class SearchManagerService {

    public setToolbarSearch(): Promise<void> {
        return new Promise((resolve) => {
            ToolbarSessionsService.setActive(ToolbarSessionsService.getDefaultsGuids().search);
            resolve();
        });
    }

}

export default (new SearchManagerService());
