import { ethers, network } from 'hardhat';
import {
  explorerUrl,
  printAppEnv,
  resolveOrganizationHash,
  writeDeployment,
} from './helpers';

const LOCAL_NETWORKS = new Set(['localhost', 'hardhat']);

async function main() {
  const isLocal = LOCAL_NETWORKS.has(network.name);
  const rpcVar = `${network.name.toUpperCase()}_RPC_URL`;
  const hrAdmin = process.env.HR_ADMIN_ADDRESS?.trim();
  const organizationHash = resolveOrganizationHash();

  // Fail before deployment, not after spending gas on a registry nobody can use.
  if (!isLocal) {
    const missing: string[] = [];
    if (!process.env[rpcVar]?.trim()) missing.push(rpcVar);
    if (!process.env.DEPLOYER_PRIVATE_KEY?.trim()) missing.push('DEPLOYER_PRIVATE_KEY');
    if (!hrAdmin) missing.push('HR_ADMIN_ADDRESS');
    if (!organizationHash) missing.push('ORGANIZATION_ID (or ORGANIZATION_HASH)');

    if (missing.length > 0) {
      throw new Error(
        `Cannot deploy to ${network.name}. Add these to blockchain/.env: ${missing.join(', ')}. See blockchain/.env.example.`,
      );
    }
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('No deployer account configured.');

  console.log(`Deploying EmploymentContractRegistry to "${network.name}"...`);
  console.log(`Deployer: ${deployer.address}`);

  const nativeSymbol = network.name === 'amoy' ? 'POL' : 'ETH';

  if (!isLocal) {
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Deployer balance: ${ethers.formatEther(balance)} ${nativeSymbol}`);

    if (balance === 0n) {
      throw new Error(
        `Deployer ${deployer.address} has no ${nativeSymbol} on ${network.name}. Fund it from a faucet, then retry.`,
      );
    }
  }

  const factory = await ethers.getContractFactory('EmploymentContractRegistry');
  const registry = await factory.deploy(deployer.address);
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const deploymentTx = registry.deploymentTransaction();
  const deploymentReceipt = deploymentTx ? await deploymentTx.wait() : null;

  const deployment = {
    address,
    chainId,
    network: network.name,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    blockNumber: deploymentReceipt?.blockNumber ?? null,
    transactionHash: deploymentTx?.hash ?? null,
  };

  const file = writeDeployment(network.name, deployment);
  console.log(`Registry deployed at ${address}`);
  console.log(`Deployment written to ${file}`);

  if (hrAdmin && organizationHash) {
    console.log(`Granting HR rights to ${hrAdmin} for organisation ${organizationHash}...`);
    const tx = await registry.setHrAdmin(hrAdmin, organizationHash);
    await tx.wait();
    console.log(`HR admin granted (tx ${tx.hash}).`);
  } else {
    console.log(
      `\nNo HR admin granted. Set HR_ADMIN_ADDRESS + ORGANIZATION_ID in blockchain/.env and run "npm run grant:${network.name}".`,
    );
  }

  const explorer = explorerUrl(network.name);
  if (explorer) {
    console.log(`Explorer: ${explorer}/address/${address}`);
  }

  if (!isLocal) {
    console.log('\nVerify the source (optional):');
    console.log(`  npx hardhat verify --network ${network.name} ${address} ${deployer.address}`);
    const etherscanVar = `${network.name.toUpperCase()}_ETHERSCAN_API_KEY`;
    if (!process.env[etherscanVar]?.trim() && !process.env.ETHERSCAN_API_KEY?.trim()) {
      console.log(`  (set ${etherscanVar} or ETHERSCAN_API_KEY in blockchain/.env first)`);
    }
  }

  printAppEnv(address, chainId);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
