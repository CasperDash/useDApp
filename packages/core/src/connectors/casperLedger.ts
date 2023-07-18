/* eslint-disable @typescript-eslint/no-unused-vars */
import { Buffer } from 'buffer';

import { DeployUtil, CLPublicKey } from 'casper-js-sdk';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import CasperApp from '@zondax/ledger-casper';
import { JsonTypes } from 'typedjson';

import { AlgoEnum } from '../enums';
import { CONNECT_ERROR_MESSAGE, getLedgerError, getLedgerPath } from '../utils';
import { Deploy } from '../types/deploy';
import { ConnectorNotFoundError } from '../errors';

import { Connector } from './base';

type CasperLedgerConnectorOptions = {
  enableDebugLogs?: boolean;
  getEventProvider?: () => EventProvider;
};

type Provider = CasperApp;
type EventProvider = Window;

type LedgerOption = { index?: string };

export class CasperLedgerConnector extends Connector<
Provider,
Window,
CasperLedgerConnectorOptions
>  {
  public isReady!: boolean;
  public readonly id: string = 'ledger';
  public transport!: TransportWebUSB;
  public casperApp?: Provider;
  public accountIndex?: string;
  public eventProvider?: EventProvider;

  constructor({
    options: defaultOptions,
  }: { options?: CasperLedgerConnectorOptions } = {}) {
    const options = {
      name: 'CasperLedger',
      getEventProvider: (): EventProvider => {
        return window;
      },
      ...defaultOptions,
    };

    super({ options });
  }

  public async getProvider(): Promise<Provider> {
    await this.connect();

    if (!this.casperApp) {
      throw new ConnectorNotFoundError();
    }

    return this.casperApp;
  }

  /**
   * > This function returns the event provider that was passed in the options object
   * @returns The event provider
   */
  public async getEventProvider(): Promise<EventProvider> {
    const eventProvider = this.options.getEventProvider?.();
    if (!eventProvider) {
      throw new ConnectorNotFoundError();
    }

    this.eventProvider = eventProvider;

    return this.eventProvider;
  }

  public setAccountIndex(index: string): void {
    this.accountIndex = index;
  }

  public getAccountIndex(): string | undefined {
    return this.accountIndex || '0';
  }

  public async getPublicKey(index: string): Promise<string> {
    const casperApp = await this.getProvider();
    if (!casperApp) {
      throw new Error('Please connect to Casper Ledger');
    }
    let publicKey;
    try {

      const path = getLedgerPath(index);

      const value = await casperApp.getAddressAndPubKey(path);

      if (value.errorMessage && value.errorMessage !== 'No errors') {
        throw new Error(value.errorMessage);
      }
      publicKey = value.publicKey;
    } catch (error) {
      await this.transport.close();

      throw Error(getLedgerError(error as Error));
    }

    await this.transport.close();

    if (!publicKey) {

      throw Error(CONNECT_ERROR_MESSAGE);
    }

    return `${AlgoEnum.SECP256K1}${publicKey.toString('hex')}`;
  }

  public async isConnected(): Promise<boolean> {
    return !! await this.getActivePublicKey();
  }

  public async disconnect(): Promise<void> {
    // Do nothing
    return;
  }

  public async connect(): Promise<void> {
    try {
      const transport = <TransportWebUSB> await TransportWebUSB.create();

      this.transport = transport;
      this.casperApp = new CasperApp(transport);

      this.transport.on('disconnect', this.onDisconnected);

    } catch (error) {
      throw Error(getLedgerError(error as Error));
    }
  }

  public async getActivePublicKey(): Promise<string> {
    return this.getPublicKey(this.accountIndex || '0');
  }

  // eslint-disable-next-line @typescript-eslint/typedef, @typescript-eslint/no-unused-vars
  public async signMessage(message: string, _signingPublicKeyHex = '', { index = '0' }: LedgerOption =  { index: '0' }): Promise<string> {
    const casperApp = await this.getProvider();
    if (!casperApp) {
      throw new Error('Please connect to Casper Ledger');
    }

    const ledgerPrefix = 'Casper Message:\n';

    const signatureResponse = await casperApp.signMessage(
      getLedgerPath(this.accountIndex || index),
      Buffer.from(`${ledgerPrefix}${message}`, 'utf8'),
    );

    if (!signatureResponse) {
      await this.transport.close();

      throw new Error('Error on sign message with ledger.');

    }

    await this.transport.close();

    return Buffer.from(signatureResponse.signatureRSV).toString('hex');
  }

  // eslint-disable-next-line @typescript-eslint/typedef, @typescript-eslint/no-unused-vars
  public async sign(
    deploy: { deploy: JsonTypes },
    signingPublicKeyHex: string,
    _targetPublicKeyHex: string,
    { index = '0' }: LedgerOption =  { index: '0' }): Promise<Deploy> {
    const casperApp = await this.getProvider();
    if (!casperApp) {
      throw new Error('Please connect to Casper Ledger');
    }
    const deployCasper = DeployUtil.deployFromJson(deploy);
    const deployJson = deployCasper.unwrap();
    const responseDeploy = await casperApp.sign(
      getLedgerPath(this.accountIndex || index),
      <Buffer> DeployUtil.deployToBytes(deployJson),
    );

    if (!responseDeploy.signatureRS) {
      console.error(responseDeploy.errorMessage);
      await this.transport.close();
      throw Error(getLedgerError({
        message: responseDeploy.errorMessage,
        name: '',
      }, responseDeploy.returnCode));
    }

    const signedDeploy = DeployUtil.setSignature(
      deployJson,
      responseDeploy.signatureRS,
      CLPublicKey.fromHex(signingPublicKeyHex),
    );

    const deployValided: { ok?: boolean; val: DeployUtil.Deploy } =
    <{ ok?: boolean; val: DeployUtil.Deploy }><unknown> DeployUtil.validateDeploy(signedDeploy);
    if (deployValided?.ok) {
      await this.transport.close();

      return DeployUtil.deployToJson(deployValided.val);
    } else {
      await this.transport.close();
      throw new Error('Error on sign deploy with ledger.');
    }
  }

  public onConnected(_event: CustomEventInit): void {
    throw new Error('Method not implemented.');
  }

  /**
   * It emits a custom event called 'casper:disconnect'
   */
  public onDisconnected(): void {
    const customEvent = new CustomEvent('casper:disconnect');
    window.dispatchEvent(customEvent);
    // this.emit('disconnect');
  }

  public onActiveKeyChanged(_event: CustomEventInit): void {
    throw new Error('Method not implemented.');
  }
}