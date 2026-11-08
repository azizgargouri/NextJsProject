import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Copies the compiled ABI into the Next.js app so the client/server can talk
 * to the registry without depending on Hardhat artifacts at runtime.
 */
function main() {
  const artifactFile = path.resolve(
    __dirname,
    '..',
    'artifacts',
    'contracts',
    'EmploymentContractRegistry.sol',
    'EmploymentContractRegistry.json',
  );

  if (!fs.existsSync(artifactFile)) {
    throw new Error('Artifact not found. Run "npm run compile" first.');
  }

  const artifact = JSON.parse(fs.readFileSync(artifactFile, 'utf8')) as { abi: unknown[] };
  const target = path.resolve(
    __dirname,
    '..',
    '..',
    'lib',
    'blockchain',
    'abi',
    'EmploymentContractRegistry.json',
  );

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(artifact.abi, null, 2)}\n`);

  console.log(`ABI exported to ${target}`);
}

main();
