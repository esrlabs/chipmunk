import { Define, Interface, SignatureRequirement } from '../declarations';

@Define({ name: 'HelpTabRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'HelpTabResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
