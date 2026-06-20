import { WalletsKit, StellarWalletsKit, WalletNetwork, WalletType, MAINNET, TESTNET, SUPPORTED_WALLETS } from '../stellar-wallets-kit';

describe('WalletNetwork enum', () => {
  it('has PUBLIC value', () => {
    expect(WalletNetwork.PUBLIC).toBe('public');
  });

  it('has TESTNET value', () => {
    expect(WalletNetwork.TESTNET).toBe('testnet');
  });
});

describe('WalletType enum', () => {
  it('has FREIGHTER value', () => {
    expect(WalletType.FREIGHTER).toBe('freighter');
  });

  it('has ALBEDO value', () => {
    expect(WalletType.ALBEDO).toBe('albedo');
  });

  it('has XBULL value', () => {
    expect(WalletType.XBULL).toBe('xbull');
  });

  it('has WALLET_CONNECT value', () => {
    expect(WalletType.WALLET_CONNECT).toBe('wallet_connect');
  });

  it('has RABET value', () => {
    expect(WalletType.RABET).toBe('rabet');
  });

  it('has LEDGER value', () => {
    expect(WalletType.LEDGER).toBe('ledger');
  });

  it('has TREZOR value', () => {
    expect(WalletType.TREZOR).toBe('trezor');
  });
});

describe('MAINNET and TESTNET exports', () => {
  it('MAINNET equals WalletNetwork.PUBLIC', () => {
    expect(MAINNET).toBe(WalletNetwork.PUBLIC);
    expect(MAINNET).toBe('public');
  });

  it('TESTNET equals WalletNetwork.TESTNET', () => {
    expect(TESTNET).toBe(WalletNetwork.TESTNET);
    expect(TESTNET).toBe('testnet');
  });
});

describe('SUPPORTED_WALLETS', () => {
  it('contains the expected wallets', () => {
    const walletIds = SUPPORTED_WALLETS.map((w) => w.id);
    expect(walletIds).toContain(WalletType.FREIGHTER);
    expect(walletIds).toContain(WalletType.ALBEDO);
    expect(walletIds).toContain(WalletType.XBULL);
    expect(walletIds).toContain(WalletType.RABET);
  });

  it('each wallet has required fields', () => {
    SUPPORTED_WALLETS.forEach((wallet) => {
      expect(wallet).toHaveProperty('id');
      expect(wallet).toHaveProperty('name');
      expect(wallet).toHaveProperty('type');
    });
  });
});

describe('WalletsKit', () => {
  it('constructor sets network and selected wallet ID', () => {
    const kit = new WalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: 'xbull',
    });

    expect(kit).toBeInstanceOf(WalletsKit);
  });

  it('accepts mainnet network', () => {
    const kit = new WalletsKit({
      network: MAINNET,
      selectedWalletId: 'freighter',
    });

    expect(kit).toBeInstanceOf(WalletsKit);
  });
});

describe('WalletsKit.connect', () => {
  it('returns a mock public key and type', async () => {
    const kit = new WalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: 'xbull',
    });

    const result = await kit.connect();

    expect(result).toHaveProperty('publicKey');
    expect(result).toHaveProperty('type');
    expect(result.publicKey).toBe('G' + 'A'.repeat(55));
    expect(result.type).toBe('xbull');
  });

  it('returns type matching selectedWalletId', async () => {
    const kit = new WalletsKit({
      network: WalletNetwork.PUBLIC,
      selectedWalletId: 'albedo',
    });

    const result = await kit.connect();
    expect(result.type).toBe('albedo');
  });
});

describe('WalletsKit.disconnect', () => {
  it('resolves successfully', async () => {
    const kit = new WalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: 'xbull',
    });

    await expect(kit.disconnect()).resolves.toBeUndefined();
  });
});

describe('WalletsKit.getWallet', () => {
  it('returns null by default', async () => {
    const kit = new WalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: 'xbull',
    });

    const wallet = await kit.getWallet();
    expect(wallet).toBeNull();
  });
});

describe('WalletsKit.signTransaction', () => {
  it('returns the XDR as-is', async () => {
    const kit = new WalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: 'xbull',
    });

    const xdr = 'AAAAA...signed-xdr...';
    const result = await kit.signTransaction(xdr);

    expect(result).toBe(xdr);
  });

  it('accepts optional network passphrase', async () => {
    const kit = new WalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: 'xbull',
    });

    const xdr = 'AAAAA...xdr...';
    const result = await kit.signTransaction(xdr, {
      networkPassphrase: 'Test SDF Network ; September 2015',
    });

    expect(result).toBe(xdr);
  });
});

describe('WalletsKit.setNetwork', () => {
  it('updates the network', () => {
    const kit = new WalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: 'xbull',
    });

    kit.setNetwork(MAINNET);
  });
});

describe('StellarWalletsKit', () => {
  it('constructor sets network and selected wallet ID', () => {
    const kit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: 'freighter',
    });

    expect(kit).toBeInstanceOf(StellarWalletsKit);
  });
});

describe('StellarWalletsKit.getAddress', () => {
  it('returns a mock address and wallet type', async () => {
    const kit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: 'freighter',
    });

    const address = await kit.getAddress();

    expect(address).toHaveProperty('address');
    expect(address).toHaveProperty('walletType');
    expect(address.address).toBe('G' + 'A'.repeat(55));
    expect(address.walletType).toBe(WalletType.FREIGHTER);
  });
});

describe('StellarWalletsKit.sign', () => {
  it('returns the XDR as result', async () => {
    const kit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: 'freighter',
    });

    const result = await kit.sign({
      xdr: 'my-xdr-content',
      network: WalletNetwork.TESTNET,
    });

    expect(result.result).toBe('my-xdr-content');
  });
});

describe('StellarWalletsKit.setWallet', () => {
  it('updates the current wallet ID', () => {
    const kit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: 'freighter',
    });

    kit.setWallet('xbull');
    expect(kit.getSelectedWalletId()).toBe('xbull');
  });
});

describe('StellarWalletsKit.getSelectedWalletId', () => {
  it('returns the selected wallet ID', () => {
    const kit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: 'albedo',
    });

    expect(kit.getSelectedWalletId()).toBe('albedo');
  });
});

describe('StellarWalletsKit.setNetwork and getNetwork', () => {
  it('sets and gets the network', () => {
    const kit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: 'freighter',
    });

    expect(kit.getNetwork()).toBe(WalletNetwork.TESTNET);

    kit.setNetwork(MAINNET);
    expect(kit.getNetwork()).toBe(MAINNET);
  });
});
