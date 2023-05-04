import { Define, Interface, SignatureRequirement } from '../declarations';

@Define({ name: 'ExitRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'ExitResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
