import { Define, Interface, SignatureRequirement } from '../declarations';

@Define({ name: 'ThemeDarkRequest' })
export class Request extends SignatureRequirement {}
export interface Request extends Interface {}

@Define({ name: 'ThemeDarkResponse' })
export class Response extends SignatureRequirement {}

export interface Response extends Interface {}
