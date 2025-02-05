import { Define, Interface, SignatureRequirement } from '../declarations';

@Define({ name: 'ImportSessionStateRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'ImportSessionStateResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
