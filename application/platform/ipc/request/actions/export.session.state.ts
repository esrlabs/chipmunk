import { Define, Interface, SignatureRequirement } from '../declarations';

@Define({ name: 'ExportSessionStateRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'ExportSessionStateResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
