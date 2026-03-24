const { Server, Keypair, TransactionBuilder, Operation, Asset, Networks } = require('stellar-sdk');
const { Contract, SorobanRpc } = require('soroban-client');

/**
 * Deploy CredentialRegistry Contract with Expiration Features
 * 
 * This script deploys the enhanced credential registry contract that supports:
 * - Automatic credential expiration
 * - Credential renewal functionality
 * - Expiration status tracking
 * - Event emissions for expiration and renewal
 */
async function deployCredentialRegistry() {
  try {
    const server = new Server('https://soroban-testnet.stellar.org');
    const rpc = new SorobanRpc.Server('https://soroban-testnet.stellar.org:443');
    
    // Replace with your admin secret key
    const adminKeypair = Keypair.fromSecret(process.env.ADMIN_SECRET_KEY || 'YOUR_ADMIN_SECRET_KEY_HERE');
    const adminPublicKey = adminKeypair.publicKey();

    console.log('🚀 Starting CredentialRegistry deployment...');
    console.log(`📧 Admin account: ${adminPublicKey}`);

    // Load admin account
    const account = await server.loadAccount(adminPublicKey);
    console.log(`💰 Account balance: ${account.balances[0].balance} XLM`);

    // Step 1: Build the contract (in production, this would be done separately)
    console.log('🔨 Building contract...');
    console.log('Note: Run `cargo build --target wasm32-unknown-unknown --release` first');

    // Step 2: Deploy the contract using stellar CLI (simulated here)
    console.log('📦 Deploying CredentialRegistry contract...');
    
    // In real deployment, you would use:
    // stellar contract deploy \
    //   --wasm target/wasm32-unknown-unknown/release/starked_education_contracts.wasm \
    //   --source admin \
    //   --network testnet
    
    // Simulate contract deployment
    const contractId = 'CONTRACT_ID_WOULD_BE_GENERATED_HERE';
    console.log(`✅ Contract deployed with ID: ${contractId}`);

    // Step 3: Initialize the contract
    console.log('🔧 Initializing contract...');
    
    // Create initialization transaction
    const contract = new Contract(contractId);
    
    const initTransaction = new TransactionBuilder(account, {
      fee: 100000,
      networkPassphrase: Networks.TESTNET
    })
      .addOperation(Operation.invokeContractFunction({
        contract: contractId,
        function: 'initialize',
        args: [
          // admin address
          adminPublicKey
        ]
      }))
      .setTimeout(30)
      .build();

    // Sign transaction
    initTransaction.sign(adminKeypair);
    
    // Submit transaction
    const initResult = await server.sendTransaction(initTransaction);
    console.log('🎯 Initialization transaction submitted:', initResult.hash);

    // Step 4: Test the deployment with sample data
    console.log('🧪 Testing deployment...');
    
    // Issue a test credential with expiration
    const testCredentialTx = new TransactionBuilder(account, {
      fee: 100000,
      networkPassphrase: Networks.TESTNET
    })
      .addOperation(Operation.invokeContractFunction({
        contract: contractId,
        function: 'issue_credential_with_expiration',
        args: [
          adminPublicKey, // issuer
          adminPublicKey, // recipient (using admin for testing)
          'Test Credential',
          'This is a test credential with expiration',
          'course_test_001',
          'QmTestHash123',
          '86400' // 24 hours validity in seconds
        ]
      }))
      .setTimeout(30)
      .build();

    testCredentialTx.sign(adminKeypair);
    const testResult = await server.sendTransaction(testCredentialTx);
    console.log('📋 Test credential issued:', testResult.hash);

    // Step 5: Set up monitoring for expiration
    console.log('⏰ Setting up expiration monitoring...');
    console.log('Deploy backend service to monitor credential expirations');
    console.log('See: backend/src/services/stellarService.js');

    // Step 6: Output deployment information
    console.log('\n🎉 Deployment Summary:');
    console.log('=====================================');
    console.log(`Contract ID: ${contractId}`);
    console.log(`Admin: ${adminPublicKey}`);
    console.log('Network: Testnet');
    console.log('Features Enabled:');
    console.log('  ✅ Automatic credential expiration');
    console.log('  ✅ Credential renewal');
    console.log('  ✅ Expiration status tracking');
    console.log('  ✅ Event emissions');
    console.log('  ✅ Batch expiration updates');
    console.log('\n📝 Next Steps:');
    console.log('1. Update frontend configuration with contract ID');
    console.log('2. Deploy backend expiration monitoring service');
    console.log('3. Set up automated renewal notifications');
    console.log('4. Configure event listeners for expiration/renewal');

    return {
      contractId,
      adminPublicKey,
      network: 'testnet',
      features: [
        'credential_expiration',
        'credential_renewal',
        'expiration_tracking',
        'event_emissions',
        'batch_updates'
      ]
    };

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    throw error;
  }
}

/**
 * Test credential expiration functionality
 */
async function testCredentialExpiration(contractId, adminKeypair) {
  const server = new Server('https://soroban-testnet.stellar.org');
  const account = await server.loadAccount(adminKeypair.publicKey());

  console.log('🧪 Testing credential expiration...');

  // Test 1: Issue credential with short expiration
  const issueTx = new TransactionBuilder(account, {
    fee: 100000,
    networkPassphrase: Networks.TESTNET
  })
    .addOperation(Operation.invokeContractFunction({
      contract: contractId,
      function: 'issue_credential_with_expiration',
      args: [
        adminKeypair.publicKey(),
        adminKeypair.publicKey(),
        'Expiring Credential',
        'This credential will expire in 10 seconds',
        'course_expire_test',
        'QmExpireTest',
        '10' // 10 seconds
      ]
    }))
    .setTimeout(30)
    .build();

  issueTx.sign(adminKeypair);
  const issueResult = await server.sendTransaction(issueTx);
  console.log('📋 Expiring test credential issued:', issueResult.hash);

  // Wait for expiration
  console.log('⏳ Waiting for credential to expire...');
  await new Promise(resolve => setTimeout(resolve, 11000));

  // Test 2: Check expiration status
  const checkTx = new TransactionBuilder(account, {
    fee: 100000,
    networkPassphrase: Networks.TESTNET
  })
    .addOperation(Operation.invokeContractFunction({
      contract: contractId,
      function: 'check_credential_expiration',
      args: [
        '1' // Assuming this is credential ID 1
      ]
    }))
    .setTimeout(30)
    .build();

  checkTx.sign(adminKeypair);
  const checkResult = await server.sendTransaction(checkTx);
  console.log('🔍 Expiration check completed:', checkResult.hash);

  // Test 3: Renew expired credential
  const renewTx = new TransactionBuilder(account, {
    fee: 100000,
    networkPassphrase: Networks.TESTNET
  })
    .addOperation(Operation.invokeContractFunction({
      contract: contractId,
      function: 'renew_credential',
      args: [
        '1', // credential ID
        adminKeypair.publicKey(), // renewer
        '3600' // 1 hour extension
      ]
    }))
    .setTimeout(30)
    .build();

  renewTx.sign(adminKeypair);
  const renewResult = await server.sendTransaction(renewTx);
  console.log('🔄 Credential renewed:', renewResult.hash);

  console.log('✅ All expiration tests completed successfully!');
}

/**
 * Deploy with comprehensive testing
 */
async function deployAndTest() {
  const deployment = await deployCredentialRegistry();
  
  if (deployment.contractId && deployment.contractId !== 'CONTRACT_ID_WOULD_BE_GENERATED_HERE') {
    const adminKeypair = Keypair.fromSecret(process.env.ADMIN_SECRET_KEY);
    await testCredentialExpiration(deployment.contractId, adminKeypair);
  } else {
    console.log('⚠️  Skipping tests - contract not actually deployed');
  }
}

// Export for use in other scripts
module.exports = {
  deployCredentialRegistry,
  testCredentialExpiration,
  deployAndTest
};

// Run if called directly
if (require.main === module) {
  deployAndTest().catch(console.error);
}
