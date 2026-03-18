/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "firebase/compat/app" {
  const firebase: any;
  export default firebase;
}

declare module "firebase/compat/auth" {}

declare module "ethers" {
  export const ethers: any;
  export class BrowserProvider {
    constructor(provider: any);
    send(method: string, params: any[]): Promise<any>;
    getSigner(): Promise<any>;
  }
}

declare module "web3-token" {
  export function sign(
    signer: (msg: string) => Promise<string>,
    expiry: string
  ): Promise<string>;
}

declare module "lodash" {
  export function camelCase(str: string): string;
  export function capitalize(str: string): string;
  export function snakeCase(str: string): string;
}
