import { getHTMLFromASCII } from './parser';

(window as any).setPluginModule({
    commonRowParser: getHTMLFromASCII,
});
