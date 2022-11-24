import { Define, Interface, SignatureRequirement } from '../declarations';

@Define({ name: 'AboutDialogRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'AboutDialogResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
