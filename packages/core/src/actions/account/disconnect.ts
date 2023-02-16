import { StatusEnum } from '@casperdash/usewallet-core/enums';
import { getClient, StateParams } from '@casperdash/usewallet-core/utils/client';

export const disconnect = async (): Promise<void> => {
  const client = getClient();

  try {
    await client.connector?.disconnect();
    client.setState((oldState: StateParams) => ({
      ...oldState,
      status: StatusEnum.DISCONNECTED,
      data: {
        ...oldState.data,
        activeKey: undefined,
      },
    }));
  } catch (error) {
    console.error(error);
  }
};
