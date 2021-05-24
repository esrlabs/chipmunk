// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

import { Session } from '../src/api/session';

// Get rid of default Jasmine timeout
jasmine.DEFAULT_TIMEOUT_INTERVAL = 900000;

export function checkSessionDebugger(session: Session) {
	const stat = session.getDebugStat();
	if (stat.unsupported.length !== 0) {
		fail(new Error(`Unsupported events:\n\t- ${stat.unsupported.join('\n\t- ')}`));
	}
	if (stat.errors.length !== 0) {
		fail(new Error(`Errors:\n\t- ${stat.errors.join('\n\t- ')}`));
	}
}
