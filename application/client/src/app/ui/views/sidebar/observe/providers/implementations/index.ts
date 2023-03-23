import { Provider as Files } from './files';
import { Provider as Processes } from './processes';
import { Provider as Serial } from './serial';
import { Provider as Tcp } from './tcp';
import { Provider as Udp } from './udp';

export const PROVIDERS = [Files, Processes, Serial, Tcp, Udp];
