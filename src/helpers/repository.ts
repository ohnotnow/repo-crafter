// Repository-related operations and validations

import type { ApiError, AppLogger } from './types.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Validates that a user is a member of the specified organization
 */
export async function validateOrganizationMembership(
  octokit: any,
  organization: string,
  repositoryAdmin: string,
  logger?: AppLogger
): Promise<ApiError | null> {
  try {
    logger?.debug({ organization, repositoryAdmin }, 'Validating organization membership');
    await octokit.orgs.getMembershipForUser({
      org: organization,
      username: repositoryAdmin
    });
    logger?.debug({ organization, repositoryAdmin }, 'Organization membership confirmed');
    return null; // Success - user is a member
  } catch (membershipError: any) {
    const status = membershipError.response?.status;
    let errorMessage = `User ${repositoryAdmin} is not a member of organization ${organization}`;
    let errorCode = "USER_NOT_ORGANIZATION_MEMBER";
    
    if (status === 404) {
      errorMessage = `User ${repositoryAdmin} is not a member of organization ${organization}`;
      errorCode = "USER_NOT_ORGANIZATION_MEMBER";
    } else if (status === 403) {
      errorMessage = `Cannot verify membership for ${repositoryAdmin} in ${organization} - insufficient permissions`;
      errorCode = "MEMBERSHIP_VERIFICATION_FORBIDDEN";
    } else {
      errorMessage = `Failed to verify membership for ${repositoryAdmin}: ${membershipError.message}`;
      errorCode = "MEMBERSHIP_VERIFICATION_FAILED";
    }
    
    const errorResponse: ApiError = {
      success: false,
      errorCode: errorCode,
      message: errorMessage,
      timestamp: new Date().toISOString()
    };

    logger?.warn({
      organization,
      repositoryAdmin,
      status,
      errorCode
    }, 'Organization membership validation failed');

    return errorResponse;
  }
}

/**
 * Checks if a repository with the given name already exists in the organization
 */
export async function validateRepositoryAvailability(
  octokit: any,
  organization: string,
  repositoryName: string,
  logger?: AppLogger
): Promise<ApiError | null> {
  try {
    logger?.debug({ organization, repositoryName }, 'Checking repository availability');
    await octokit.repos.get({
      owner: organization,
      repo: repositoryName
    });
    
    // If we get here, the repository exists
    const errorResponse: ApiError = {
      success: false,
      errorCode: "REPOSITORY_ALREADY_EXISTS",
      message: `Repository ${organization}/${repositoryName} already exists`,
      timestamp: new Date().toISOString()
    };
    logger?.warn({ organization, repositoryName }, 'Repository already exists');
    return errorResponse;
  } catch (repoCheckError: any) {
    // 404 means repository doesn't exist, which is what we want
    if (repoCheckError.response?.status !== 404) {
      // Some other error occurred while checking
      const errorResponse: ApiError = {
        success: false,
        errorCode: "REPOSITORY_AVAILABILITY_CHECK_FAILED",
        message: `Failed to verify repository availability: ${repoCheckError.message}`,
        timestamp: new Date().toISOString()
      };
      logger?.error({
        organization,
        repositoryName,
        status: repoCheckError.response?.status,
        errorCode: "REPOSITORY_AVAILABILITY_CHECK_FAILED"
      }, 'Repository availability check encountered an unexpected error');
      return errorResponse;
    }
    // Repository doesn't exist, we can proceed
    logger?.debug({ organization, repositoryName }, 'Repository name is available');
    return null;
  }
}

/**
 * Creates the parameters object for repository creation
 */
export function createRepositoryParams(
  organization: string,
  repositoryName: string,
  repositoryAdmin?: string,
  visibility: string = 'private'
): any {
  const createRepoParams: any = {
    org: organization,
    name: repositoryName,
    description: `Repository created via API${repositoryAdmin ? ` by ${repositoryAdmin}` : ''}`,
    auto_init: true
  };

  // Handle visibility - use both private and visibility parameters for compatibility
  if (visibility === 'private') {
    createRepoParams.private = true;
  } else if (visibility === 'public') {
    createRepoParams.private = false;
    createRepoParams.visibility = 'public';
  } else if (visibility === 'internal') {
    createRepoParams.private = false;
    createRepoParams.visibility = 'internal';
  }

  return createRepoParams;
}

/**
 * Adds a user as an admin collaborator to the repository
 */
export async function addRepositoryAdmin(
  octokit: any,
  organization: string,
  repositoryName: string,
  repositoryAdmin: string,
  fullName: string,
  logger: AppLogger
): Promise<void> {
  try {
    logger.debug({ organization, repositoryName, repositoryAdmin }, 'Adding repository admin collaborator');
    await octokit.repos.addCollaborator({
      owner: organization,
      repo: repositoryName,
      username: repositoryAdmin,
      permission: 'admin'
    });
    logger.info({ fullName, repositoryAdmin }, 'Added repository admin collaborator');
  } catch (collaboratorError: any) {
    logger.warn({
      organization,
      repositoryName,
      repositoryAdmin,
      error: collaboratorError.message
    }, 'Failed to add repository admin collaborator');
    // Continue execution - repository was created successfully
  }
}

/**
 * Loads and renders the setup issue template
 */
function loadIssueTemplate(templateData: {
  organization: string;
  repositoryName: string;
  repositoryAdmin?: string;
  adminMention?: string;
}): string {
  try {
    const templatePath = path.join(process.cwd(), 'src', 'templates', 'setup-issue.md');
    let templateContent = fs.readFileSync(templatePath, 'utf8');
    
    // Simple template rendering - replace placeholders
    templateContent = templateContent
      .replace(/\{\{organization\}\}/g, templateData.organization)
      .replace(/\{\{repositoryName\}\}/g, templateData.repositoryName);
    
    // Handle conditional sections for repositoryAdmin
    if (templateData.repositoryAdmin && templateData.adminMention) {
      templateContent = templateContent
        .replace(/\{\{#repositoryAdmin\}\}(.*?)\{\{\/repositoryAdmin\}\}/gs, '$1')
        .replace(/\{\{adminMention\}\}/g, templateData.adminMention)
        .replace(/\{\{\^repositoryAdmin\}\}(.*?)\{\{\/repositoryAdmin\}\}/gs, '');
    } else {
      templateContent = templateContent
        .replace(/\{\{#repositoryAdmin\}\}(.*?)\{\{\/repositoryAdmin\}\}/gs, '')
        .replace(/\{\{\^repositoryAdmin\}\}(.*?)\{\{\/repositoryAdmin\}\}/gs, '$1');
    }
    
    return templateContent;
  } catch (error: any) {
    // Fallback to a basic template if file loading fails
    return `# Welcome to ${templateData.organization}/${templateData.repositoryName}!

This repository has been created successfully via the repo-crafter API${templateData.repositoryAdmin ? ` and ${templateData.adminMention} has been assigned as the repository administrator` : ''}.

## 📋 Repository Setup Checklist

- [ ] Review and update the repository description
- [ ] Set up branch protection rules
- [ ] Configure repository settings (Issues, Projects, Wiki, etc.)
- [ ] Add repository topics/tags for discoverability
- [ ] Set up automated workflows (if needed)

## 🚀 Next Steps

${templateData.repositoryAdmin ? `${templateData.adminMention}, as the repository administrator, please:` : 'Please:'}

1. **Review Repository Settings** - Configure according to your team's needs
2. **Set Up Branch Protection** - Implement the security policies above
3. **Add Team Members** - Invite collaborators with appropriate permissions
4. **Create Initial Documentation** - Add README, CONTRIBUTING, and other docs
5. **Configure Integrations** - Set up any required webhooks or external services

---
*This issue was created automatically by repo-crafter. You can close it once you've completed the setup checklist.*`;
  }
}

/**
 * Creates an initial issue in the newly created repository with best practices
 */
export async function createInitialIssue(
  octokit: any,
  organization: string,
  repositoryName: string,
  repositoryAdmin?: string,
  logger?: AppLogger
): Promise<void> {
  try {
    const adminMention = repositoryAdmin ? `@${repositoryAdmin}` : 'the repository admin';
    
    const issueTitle = "🎉 Repository Created Successfully - Getting Started Guide";
    
    const issueBody = loadIssueTemplate({
      organization,
      repositoryName,
      repositoryAdmin,
      adminMention
    });

    logger?.debug({ organization, repositoryName }, 'Creating initial setup issue');

    await octokit.issues.create({
      owner: organization,
      repo: repositoryName,
      title: issueTitle,
      body: issueBody,
      labels: ['documentation', 'good first issue', 'setup']
    });

    logger?.info({ organization, repositoryName, repositoryAdmin }, 'Created initial setup issue');
  } catch (error: any) {
    logger?.warn({
      organization,
      repositoryName,
      repositoryAdmin,
      error: error.message
    }, 'Failed to create initial setup issue');
    // Don't throw error - repository creation was successful, issue creation is bonus
  }
}
