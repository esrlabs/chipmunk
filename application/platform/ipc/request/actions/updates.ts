import { Define, Interface, SignatureRequirement } from '../declarations';

@Define({ name: 'CheckForUpdatesRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'CheckForUpdatesResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
