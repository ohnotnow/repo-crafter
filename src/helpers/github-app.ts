// GitHub App installation related functions

import { Probot } from "probot";
import type { ApiError, AppLogger } from './types.js';

/**
 * Finds the GitHub App installation for the given organization
 */
export async function findInstallation(app: Probot, organization: string, logger?: AppLogger): Promise<any> {
  logger?.debug({ organization }, 'Looking up GitHub App installations');
  const appAuth = await app.auth();
  const installations = await appAuth.apps.listInstallations();
  const installation = installations.data.find(inst => inst.account?.login === organization);
  if (!installation) {
    logger?.warn({ organization }, 'No installation found for organization');
  } else {
    logger?.debug({ installationId: installation.id }, 'Found installation for organization');
  }
  return installation;
}

/**
 * Creates a standardized error response when the GitHub App is not installed for an organization
 */
export function createInstallationNotFoundError(organization: string): ApiError {
  return {
    success: false,
    errorCode: "APP_NOT_INSTALLED",
    message: `GitHub App is not installed for organization: ${organization}`,
    timestamp: new Date().toISOString()
  };
}
