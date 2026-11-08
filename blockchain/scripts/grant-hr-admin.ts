import { ethers, network } from 'hardhat';
import { resolveOrganizationHash, resolveRegistryAddress } from './helpers';

/**
 * Grants an HR wallet the right to create contracts for one organisation.
 *
 * Usage (blockchain/.env):
 *   HR_ADMIN_ADDRESS=0xYourMetaMaskWallet
 *   ORGANIZATION_ID=<Mongo _id of the hr@moveup.tn user>
 *   CONTRACT_ADDRESS=0x...   # optional, defaults to deployments/<network>.json
 *
 * Then: npm run grant:local   (or grant:amoy)
 */
async function main() {
  const [owner] = await ethers.getSigners();
  if (!owner) throw new Error('No owner account configured.');

  const address = resolveRegistryAddress(network.name);
  const hrAdmin = process.env.HR_ADMIN_ADDRESS?.trim();
  const organizationHash = resolveOrganizationHash();

  if (!hrAdmin) throw new Error('HR_ADMIN_ADDRESS is required.');
  if (!organizationHash) throw new Error('Set ORGANIZATION_ID (Mongo id) or ORGANIZATION_HASH.');

  const registry = await ethers.getContractAt('EmploymentContractRegistry', address, owner);

  console.log(`Registry:      ${address}`);
  console.log(`HR wallet:     ${hrAdmin}`);
  console.log(`Organisation:  ${organizationHash}`);

  const tx = await registry.setHrAdmin(hrAdmin, organizationHash);
  await tx.wait();

  console.log(`HR admin granted (tx ${tx.hash}).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
