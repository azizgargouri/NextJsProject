import { authApi } from './auth';
import { adminApi } from './admin';
import { moverApi } from './mover';
import { axiosClient } from './client';

/** API barrel endpoint (replicates `instanct-ui/src/api` with the Object.freeze directive). */
export const api = Object.freeze({
  auth: authApi,
  admin: adminApi,
  mover: moverApi,
});

export { axiosClient };
