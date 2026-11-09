import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';
import * as path from 'node:path';

// blockchain/.env first, then the app's root .env as a fallback.
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Public fallbacks let read-only scripts (dump/verify) work without a keyed
// provider. deploy.ts still refuses to deploy unless the network RPC is set.
const AMOY_RPC_URL = process.env.AMOY_RPC_URL?.trim() || 'https://polygon-amoy-bor-rpc.publicnode.com';
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL?.trim() || 'https://rpc.sepolia.org';
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? '';
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY?.trim() || '';
const AMOY_ETHERSCAN_API_KEY =
  process.env.AMOY_ETHERSCAN_API_KEY?.trim() || ETHERSCAN_API_KEY;
const SEPOLIA_ETHERSCAN_API_KEY =
  process.env.SEPOLIA_ETHERSCAN_API_KEY?.trim() || ETHERSCAN_API_KEY;

const accounts = DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      // OpenZeppelin 5.x uses the Cancun `mcopy` opcode in its byte helpers.
      evmVersion: 'cancun',
      // The dual-signature event has many fields; via-IR keeps it stack-safe.
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: process.env.LOCAL_RPC_URL ?? 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    amoy: {
      url: AMOY_RPC_URL,
      chainId: 80002,
      accounts,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      chainId: 11155111,
      accounts,
    },
  },
  etherscan: {
    apiKey: {
      amoy: AMOY_ETHERSCAN_API_KEY,
      sepolia: SEPOLIA_ETHERSCAN_API_KEY,
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  mocha: {
    timeout: 60_000,
  },
};

export default config;
