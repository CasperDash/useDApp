import { CasperLedgerConnector } from '@casperdash/usewallet';
import { ConnectorNotLedgerError } from '@casperdash/usewallet-core/errors';
import { StateParams, getClient } from '@casperdash/usewallet-core/utils';

type Params = { index?: string };

export const setLedgerAccountIndex = async ({ index = '0' }: Params = { index: '0' }): Promise<void> => {
  const client = getClient();

  try {
    const connector = client?.connector;
    if (connector && connector.id !== 'ledger') {
      throw new ConnectorNotLedgerError();
    }

    const publicKey = await (connector as CasperLedgerConnector).getPublicKey(index);

    client.setState((oldState: StateParams) => ({
      ...oldState,
      data: {
        ...oldState.data,
        ledgerAccountIndex: index,
        activeKey: publicKey,
      },
    }));

    (connector as CasperLedgerConnector).setAccountIndex(index);
  } catch (error) {
    console.error(error);

    throw error;
  }
};
