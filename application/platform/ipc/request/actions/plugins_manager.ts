import { Define, Interface, SignatureRequirement } from '../declarations';

@Define({ name: 'PluginsManagerRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'PluginsManagerResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
