import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAuth } from '../../shared/auth/guards';
import { contractsService } from './contracts.service';

/**
 * Contracts controller — mirrors the existing module pattern: thin HTTP
 * adapter, JWT guard, service call, whitelisted JSON response.
 */
class ContractsController {
  /** GET /api/contracts — organisation directory (admins) or own contracts. */
  async list(request: NextRequest): Promise<NextResponse> {
    try {
      const user = await requireAuth(request);
      const contracts = await contractsService.listForSession(user);
      return NextResponse.json({ contracts });
    } catch (error) {
      return errorResponse(error);
    }
  }

  /** GET /api/contracts/proposals — proposals waiting for an employee signature. */
  async listProposals(request: NextRequest): Promise<NextResponse> {
    try {
      const user = await requireAuth(request);
      const proposals = await contractsService.listProposals(user);
      return NextResponse.json({ proposals });
    } catch (error) {
      return errorResponse(error);
    }
  }

  /** GET /api/contracts/[id] — one contract, scoped to the session. */
  async one(request: NextRequest, id: string): Promise<NextResponse> {
    try {
      const user = await requireAuth(request);
      const contract = await contractsService.findOne(id, user);
      return NextResponse.json({ contract });
    } catch (error) {
      return errorResponse(error);
    }
  }
}

export const contractsController = new ContractsController();
