import { randomUUID } from 'node:crypto';
import { Probot } from "probot";
import type { AppLogger, RepositoryRequest, Response } from './helpers/types.js';
import { validateRequiredParameters, validateVisibility } from './helpers/validation.js';
import { validateApiKey } from './helpers/auth.js';
import { findInstallation, createInstallationNotFoundError } from './helpers/github-app.js';
import { 
  validateOrganizationMembership, 
  validateRepositoryAvailability, 
  createRepositoryParams, 
  addRepositoryAdmin,
  createInitialIssue
} from './helpers/repository.js';
import { createSuccessResponse, createErrorResponse } from './helpers/responses.js';

export default (app: Probot, { getRouter }: { getRouter?: (prefix: string) => any } = {}) => {

  if (!process.env.LOG_LEVEL) {
    app.log.level = 'trace';
    app.log.debug('LOG_LEVEL not set, defaulting to trace for maximum verbosity');
  }

  // Only set up router if getRouter is provided (for HTTP endpoints)
  if (getRouter) {
    // Get an express router to expose new HTTP endpoints
    const router = getRouter("/repo-crafter");

    const sanitizeBody = (body: any) => {
      if (!body || typeof body !== 'object') {
        return body;
      }
      const clone: Record<string, unknown> = { ...body };
      for (const key of Object.keys(clone)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('key')) {
          clone[key] = '[redacted]';
        }
      }
      return clone;
    };

    const getRequestLogger = (req: any): AppLogger => {
      return (req.log as AppLogger) || (app.log as unknown as AppLogger);
    };

    router.use((req: any, res: any, next: any) => {
      const requestId = req.headers['x-request-id'] || req.headers['x-ms-request-id'] || randomUUID();
      const logger = app.log.child({
        requestId,
        method: req.method,
        path: req.originalUrl || req.url
      }) as AppLogger;

      req.log = logger;

      const startTime = Date.now();

      logger.info({
        headers: {
          userAgent: req.headers['user-agent'],
          githubDelivery: req.headers['x-github-delivery'],
          authorizationPresent: Boolean(req.headers['authorization']),
          apiKeyPresent: Boolean(req.headers['x-api-key'] || req.headers['X-API-Key'])
        },
        query: req.query
      }, 'Incoming HTTP request');

      res.on('finish', () => {
        logger.debug({
          statusCode: res.statusCode,
          durationMs: Date.now() - startTime,
          contentLength: res.getHeader('content-length')
        }, 'Request completed');
      });

      res.on('close', () => {
        if (!res.writableEnded) {
          logger.warn({
            statusCode: res.statusCode,
            durationMs: Date.now() - startTime
          }, 'Connection closed before response completed');
        }
      });

      next();
    });

    // Configuration - API key from environment variable
    const API_KEY = process.env.REPO_CRAFTER_API_KEY || "your-secret-api-key-here";
    const REQUIRE_AUTH = process.env.REPO_CRAFTER_REQUIRE_AUTH !== 'false'; // Default to true
    const CREATE_SETUP_ISSUE = process.env.REPO_CRAFTER_CREATE_SETUP_ISSUE !== 'false'; // Default to true

    // Add JSON body parsing middleware
    router.use((req: any, _res: any, next: any) => {
      if (req.method === 'POST' && req.headers['content-type']?.includes('application/json')) {
        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk.toString();
        });
        req.on('end', () => {
          const logger = getRequestLogger(req);
          try {
            req.body = JSON.parse(body);
            logger.debug({
              bodyKeys: Object.keys(req.body || {}),
              rawBodyLength: body.length
            }, 'Parsed JSON body');
          } catch (e) {
            req.body = {};
            logger.warn({
              err: e,
              rawBodyLength: body.length
            }, 'Failed to parse JSON body');
          }
          next();
        });
      } else {
        next();
      }
    });

    // Repository creation endpoint
    router.post("/create-repository", async (req: RepositoryRequest, res: Response) => {
      const logger = getRequestLogger(req);
      logger.debug('Create repository handler invoked');

      // Authentication check (if enabled)
      if (REQUIRE_AUTH) {
        logger.debug('Authenticating request with API key');
        const authError = validateApiKey(req, API_KEY);
        if (authError) {
          logger.warn({ errorCode: authError.errorCode }, 'Authentication failed for incoming request');
          app.log.warn("Authentication failed", { 
            errorCode: authError.errorCode,
            userAgent: req.headers?.['user-agent'] || 'unknown'
          });
          return res.json(authError);
        }
        app.log.info("Request authenticated successfully");
        logger.info('Request authenticated successfully');
      }

      const { organization, repositoryName, repositoryAdmin, visibility = 'private' } = req.body;
      logger.info({
        organization,
        repositoryName,
        repositoryAdmin,
        visibility
      }, 'Processing repository creation request');
      
      app.log.info("Repository creation API called", { organization, repositoryName, repositoryAdmin, visibility });
      
      try {
        // Validate required parameters
        logger.debug('Validating required parameters');
        const paramError = validateRequiredParameters(organization, repositoryName);
        if (paramError) {
          logger.warn({ errorCode: paramError.errorCode }, 'Required parameter validation failed');
          return res.json(paramError);
        }

        // At this point, organization and repositoryName are guaranteed to be strings
        const orgName = organization!;
        const repoName = repositoryName!;

        // Validate visibility parameter
        logger.debug({ visibility }, 'Validating visibility parameter');
        const visibilityError = validateVisibility(visibility);
        if (visibilityError) {
          logger.warn({ errorCode: visibilityError.errorCode }, 'Visibility validation failed');
          return res.json(visibilityError);
        }

        app.log.info(`Creating ${visibility} repository: ${orgName}/${repoName}`);
        logger.info({ orgName, repoName, visibility }, 'Creating repository');
        
        // Find GitHub App installation for the organization
        logger.debug({ orgName }, 'Looking up GitHub App installation');
        const installation = await findInstallation(app, orgName, logger);
        if (!installation) {
          logger.error({ orgName }, 'GitHub App installation not found');
          return res.json(createInstallationNotFoundError(orgName));
        }

        logger.debug({ installationId: installation.id }, 'Installation lookup succeeded');

        // Create authenticated octokit instance for the installation
        logger.debug({ installationId: installation.id }, 'Authenticating as installation');
        const octokit = await app.auth(installation.id);
        logger.debug({ installationId: installation.id }, 'Authenticated as installation');

        // Validate repository admin is a member of the organization if specified
        if (repositoryAdmin) {
          logger.debug({ repositoryAdmin }, 'Validating repository admin membership');
          const membershipError = await validateOrganizationMembership(octokit, orgName, repositoryAdmin, logger);
          if (membershipError) {
            logger.warn({
              errorCode: membershipError.errorCode,
              repositoryAdmin
            }, 'Repository admin validation failed');
            return res.json(membershipError);
          }
          app.log.info(`Verified ${repositoryAdmin} is a member of ${orgName}`);
          logger.debug({ repositoryAdmin }, 'Repository admin validated');
        }

        // Check if repository already exists
        logger.debug({ orgName, repoName }, 'Checking repository availability');
        const availabilityError = await validateRepositoryAvailability(octokit, orgName, repoName, logger);
        if (availabilityError) {
          logger.warn({ errorCode: availabilityError.errorCode }, 'Repository availability check failed');
          return res.json(availabilityError);
        }
        app.log.info(`Verified repository ${orgName}/${repoName} is available`);
        logger.debug({ orgName, repoName }, 'Repository name available');

        // Create repository
        logger.debug({ orgName, repoName, visibility }, 'Creating repository via GitHub API');
        const createRepoParams = createRepositoryParams(orgName, repoName, repositoryAdmin, visibility);
        const response = await octokit.repos.createInOrg(createRepoParams);

        const fullName = response.data.full_name;
        const htmlUrl = response.data.html_url;

        logger.info({ fullName, htmlUrl }, 'Repository created successfully');

        // Add repository admin as collaborator if specified
        if (repositoryAdmin) {
          logger.debug({ repositoryAdmin }, 'Adding repository admin as collaborator');
          await addRepositoryAdmin(octokit, orgName, repoName, repositoryAdmin, fullName, logger);
        }

        // Create initial issue with setup guide and best practices
        if (CREATE_SETUP_ISSUE) {
          logger.debug('Creating initial setup issue');
          await createInitialIssue(octokit, orgName, repoName, repositoryAdmin, logger);
        }

        const successResponse = createSuccessResponse(fullName, repoName, orgName, htmlUrl, repositoryAdmin, visibility);
        logger.info({ fullName }, 'Repository creation flow completed');
        res.json(successResponse);
      } catch (error: any) {
        const sanitizedBody = sanitizeBody(req.body);
        logger.error({ err: error, body: sanitizedBody }, 'Error creating repository');
        app.log.error("Error creating repository", error);
        res.json(createErrorResponse(error));
      }
    });

    // Add a route to get app status
    router.get("/status", (_req: any, res: Response) => {
      res.json({
        status: "running",
        app: "repo-crafter",
        timestamp: new Date().toISOString()
      });
    });
  }
};
