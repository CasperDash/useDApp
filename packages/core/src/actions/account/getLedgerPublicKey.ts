import { CasperLedgerConnector } from '@casperdash/usewallet';
import { ConnectorNotLedgerError } from '@casperdash/usewallet-core/errors';
import { getClient } from '@casperdash/usewallet-core/utils/client';

type Params = { index?: string };

/**
 * It returns the active public key of the user's wallet
 * @returns The active public key of the user.
 */
export const getLedgerPublicKey = async ({ index = '0' }: Params = { index: '0' }): Promise<string | undefined> => {
  const connector = getClient()?.connector;

  try {
    if (connector && connector.id !== 'ledger') {
      throw new ConnectorNotLedgerError();
    }
    const publicKey = await (connector as CasperLedgerConnector)?.getPublicKey(index);

    return publicKey;
  } catch (error) {
    console.error(error);

    throw error;
  }
};