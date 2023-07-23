import { JsonTypes } from 'typedjson';
import * as CasperJsSdk from 'casper-js-sdk';

import { ConnectorNotFoundError } from '../errors';
import { CasperWalletProvider } from '../types/casperWalletProvider';
import { Deploy } from '../types/deploy';

import { Connector } from './base';

const { DeployUtil, CLPublicKey } = CasperJsSdk;

type CasperWalletWindowGlobal = CasperWalletProvider;
type Provider = CasperWalletProvider;
type EventProvider = Window;

export type CasperWalletConnectorOptions = {
  name?: string;
  getProvider?: () => Provider | undefined;
  getEventProvider?: () => EventProvider;
};

/* It's a connector that connects to the Casper Signer extension */
export class CasperWalletConnector extends Connector<
CasperWalletWindowGlobal,
Window,
CasperWalletConnectorOptions
> {
  public readonly id: string = 'casperWallet';
  public isReady: boolean = false;
  private provider: Provider | undefined;
  private eventProvider: Window | undefined;

  constructor({
    options: defaultOptions,
  }: { options?: CasperWalletConnectorOptions } = {}) {
    const options = {
      name: 'CasperSigner',
      getProvider: (): Provider | undefined => {
        return typeof window !== 'undefined' && window.CasperWalletProvider
          ? window.CasperWalletProvider()
          : undefined;
      },
      getEventProvider: (): EventProvider => {
        return window;
      },
      ...defaultOptions,
    };
    super({ options });

    const provider = options.getProvider();
    this.isReady = !!provider;
  }


  // eslint-disable-next-line @typescript-eslint/require-await
  /**
   * It returns a promise that resolves to the provider object
   * @returns The provider is being returned.
   */
  public async getProvider(): Promise<CasperWalletWindowGlobal> {
    const provider = this.options.getProvider?.();
    if (!provider) {
      throw new ConnectorNotFoundError();
    }
    this.provider = provider;
    this.isReady = true;

    return this.provider;
  }


  // eslint-disable-next-line @typescript-eslint/require-await
  /**
  * It returns the event provider that was passed in the options object
  * @returns The eventProvider
  */
  public async getEventProvider(): Promise<EventProvider> {
    const eventProvider = this.options.getEventProvider?.();
    if (!eventProvider) {
      throw new ConnectorNotFoundError();
    }

    this.eventProvider = eventProvider;

    return this.eventProvider;
  }

  /**
   * It returns a promise that resolves to a boolean value that indicates whether the user is connected
   * to the blockchain
   * @returns A boolean value.
   */
  public async isConnected(): Promise<boolean> {
    try {
      const provider = await this.getProvider();

      return await provider.isConnected();
    } catch (err) {
      return false;
    }
  }

  /**
   * It disconnects the user from the site.
   */
  public async disconnect(): Promise<void> {
    const provider = await this.getProvider();

    const eventProvider = await this.getEventProvider();

    eventProvider?.removeEventListener(
      'casper-wallet:activeKeyChanged',
      this.onActiveKeyChanged,
    );
    eventProvider?.removeEventListener(
      'casper-wallet:disconnected',
      this.onDisconnected,
    );
    eventProvider?.removeEventListener('casper-wallet:connected', this.onConnected);
    eventProvider?.removeEventListener('casper-wallet:unlocked', this.onUnlocked);

    await provider.disconnectFromSite();
  }

  /**
   * It requests a connection to the provider, and then adds event listeners to the event provider
   */
  public async connect(): Promise<void> {
    const provider = await this.getProvider();

    const eventProvider = await this.getEventProvider();

    eventProvider?.addEventListener(
      'casper-wallet:activeKeyChanged',
      this.onActiveKeyChanged,
    );
    eventProvider?.addEventListener('casper-wallet:disconnected', this.onDisconnected);
    eventProvider?.addEventListener('casper-wallet:connected', this.onConnected);
    eventProvider?.addEventListener('casper-wallet:unlocked', this.onUnlocked);

    await provider.requestConnection();
  }

  /**
   * It returns the active public key of the account.
   * @returns The public key of the active account.
   */
  public async getActivePublicKey(): Promise<string | undefined> {
    const provider = await this.getProvider();

    return provider.getActivePublicKey();
  }

  /**
   * "Sign a message with the signing key of the account associated with the given public key."
   *
   * The first parameter is the message to sign. The second parameter is the public key of the account
   * that will sign the message
   * @param {string} message - The message to sign.
   * @param {string} signingPublicKeyHex - The public key of the account that will sign the message.
   * @returns A string
   */
  public async signMessage(
    message: string,
    signingPublicKeyHex: string,
  ): Promise<string | undefined> {
    const provider = await this.getProvider();

    const signatureResponse = await provider.signMessage(message, signingPublicKeyHex);
    if (signatureResponse.cancelled) {
      return undefined;
    }

    return signatureResponse.signatureHex;
  }

  /**
   * It takes a deploy, a signing public key, and a target public key, and returns a signed deploy
   * @param deploy - { deploy: JsonTypes }
   * @param {string} signingPublicKeyHex - The public key of the account that is signing the deploy.
   * @param {string} targetPublicKeyHex - The public key of the account that will be paying for the
   * deploy.
   * @returns A deploy object.
   */
  public async sign(
    deploy: { deploy: JsonTypes },
    signingPublicKeyHex: string,
  ): Promise<Deploy | undefined> {
    const provider = await this.getProvider();
    const deployJson = DeployUtil.deployFromJson(deploy);

    const res = await provider.sign(JSON.stringify(deploy), signingPublicKeyHex);

    if (res.cancelled) {
      return undefined;
    }

    const signedDeploy = DeployUtil.setSignature(
      deployJson.unwrap(),
      res.signature,
      CLPublicKey.fromHex(signingPublicKeyHex),
    );

    return DeployUtil.deployToJson(signedDeploy);
  }

  public onDisconnected(): void {
    const customEvent = new CustomEvent('casper:disconnect');
    window.dispatchEvent(customEvent);
    // this.emit('disconnect');
  }

  public onActiveKeyChanged(
    event: CustomEventInit<string>,
  ): void {
    const customEvent = new CustomEvent('casper:change', event);
    window.dispatchEvent(customEvent);
    // this.emit('change', { isConnected: event.detail?.isConnected, activeKey: event.detail?.activeKey });
  }

  public onConnected(
    event: CustomEventInit<string>,
  ): void {
    const customEvent = new CustomEvent('casper:connect', event);
    window.dispatchEvent(customEvent);
    // this.emit('connect', { isConnected: event.detail?.isConnected, activeKey: event.detail?.activeKey });
  }

  public onUnlocked(
    event: CustomEventInit<string>,
  ): void {
    const customEvent = new CustomEvent('casper:unlocked', event);
    window.dispatchEvent(customEvent);
  }
}
