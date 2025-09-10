> [!IMPORTANT]
> This is a fork to debug the original code - do not use it for real!

# Repo Crafter

A GitHub App built with [Probot](https://github.com/probot/probot) that creates repositories upon request with API key authentication.

Detailed information on a variety of topics can be found in [/docs](docs/README.md).

## Features

- **Repository Creation**: Create repositories in GitHub organizations via API
- **API Key Authentication**: Secure access with configurable authentication
- **Admin Assignment**: Automatically assign users as repository admins
- **Setup Issue Creation**: Automatically creates an issue with best practices and setup checklist
- **Validation**: Comprehensive validation for organization membership and repository availability
- **Structured Responses**: Consistent error codes and response formats
- **Configurable Visibility**: Support for public, private, and internal repositories

## Quick Start

```bash
# Install dependencies
npm install

# Set up authentication
export REPO_CRAFTER_API_KEY="your-secret-api-key-here"
export REPO_CRAFTER_REQUIRE_AUTH=true

# Run the bot
npm start
```

## Mock API for Local Development

For local development and testing, you can use a mock API to simulate GitHub API calls. This allows you to test the application's logic without needing to connect to the real GitHub API.

To enable the mock API, set the `USE_MOCK_API` environment variable to `true`:

```bash
export USE_MOCK_API=true
```

When the mock API is enabled, the application will not make any real calls to GitHub. Instead, it will return predefined responses, allowing you to test the entire flow of the application locally.

## Issue Template

When a repository is created, a setup issue is automatically generated with the the predefined content and references the newly create admin. The issue template can be found in `src/templates/setup-issue.md` and modified as needed.

## API Endpoints

### POST /repo-crafter/create-repository

Create a new GitHub repository.

```bash
curl -X POST http://localhost:3000/repo-crafter/create-repository \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secret-api-key-here" \
  -d '{
    "organization": "my-org",
    "repositoryName": "new-repo",
    "repositoryAdmin": "username",
    "visibility": "private"
  }'
```

**Parameters:**
- `organization` (required): GitHub organization name
- `repositoryName` (required): Repository name
- `repositoryAdmin` (optional): GitHub username to add as admin
- `visibility` (optional): "public", "private", or "internal" (default: "private")

**Success Response:**
```json
{
  "success": true,
  "message": "Repository my-org/new-repo created successfully",
  "repository": {
    "name": "new-repo",
    "organization": "my-org",
    "fullName": "my-org/new-repo",
    "url": "https://github.com/my-org/new-repo",
    "visibility": "private"
  }
}
```

### GET /repo-crafter/status

Check app status.

```bash
curl "http://localhost:3000/repo-crafter/status"
```

## Authentication

The API supports two authentication methods:

### X-API-Key Header
```bash
curl -H "X-API-Key: your-api-key" ...
```

### Authorization Bearer Header
```bash
curl -H "Authorization: Bearer your-api-key" ...
```

### Disable Authentication (Development)
```bash
export REPO_CRAFTER_REQUIRE_AUTH=false
```

## Configuration

### GitHub App (Probot)

Details on the creation of the GitHub App can be found in [docs/GITHUB_APP_SETUP.md](docs/GITHUB_APP_SETUP.md).

### Environment Variables

**Required:**
- `REPO_CRAFTER_API_KEY` - API key for authentication

**Optional:**
- `REPO_CRAFTER_REQUIRE_AUTH` - Enable/disable auth (default: true)
- `REPO_CRAFTER_CREATE_SETUP_ISSUE` - Enable/disable setup issue (default: true)
- `USE_MOCK_API` - Enable/disable mock API for local development (default: false)

**GitHub App (Probot):**
- `APP_ID` - GitHub App ID
- `PRIVATE_KEY_PATH` - Path to the GitHub App private key PEM file
- `WEBHOOK_SECRET` - Webhook verification secret
- `CLIENT_ID` - GitHub App client ID
- `CLIENT_SECRET` - GitHub App client secret

## GitHub Repository Secrets

For automated deployment, configure these secrets in your repository settings:

### Azure Deployment
- `AZURE_CREDENTIALS` - Azure service principal JSON for authentication

### GitHub App Configuration
- `REPOCRAFTER_APP_ID` - Your GitHub App ID
- `REPOCRAFTER_PRIVATE_KEY` - GitHub App private key (PEM format)
- `REPOCRAFTER_WEBHOOK_SECRET` - Webhook verification secret
- `REPOCRAFTER_CLIENT_ID` - GitHub App client ID
- `REPOCRAFTER_CLIENT_SECRET` - GitHub App client secret

### Application Settings
- `REPO_CRAFTER_API_KEY` - API key for repository creation endpoints

## Error Codes

| Code | Description | Status |
|------|-------------|--------|
| `MISSING_REQUIRED_PARAMETERS` | Missing organization or repositoryName | 400 |
| `INVALID_VISIBILITY` | Invalid visibility parameter | 400 |
| `MISSING_API_KEY` | API key required but not provided | 401 |
| `INVALID_API_KEY` | API key is invalid | 401 |
| `APP_NOT_INSTALLED` | GitHub App not installed on organization | 403 |
| `USER_NOT_ORGANIZATION_MEMBER` | Admin user not in organization | 403 |
| `REPOSITORY_ALREADY_EXISTS` | Repository name already taken | 409 |
| `REPOSITORY_CREATION_FAILED` | General creation failure | 500 |

## Docker Deployment

To build and run the application with Docker, you can use the provided `Dockerfile`. This is a convenient way to debug locally without needing to install nodejs/npm.

### Building the Image

```bash
# Build the container
docker build -t repo-crafter .
```

### Running the Image

To run the image, you need to provide the necessary environment variables. The easiest way to do this is with an `.env` file.

1.  **Create a `.env` file:**
    Copy the `.env.example` file to `.env` and fill in the required values. For local development with the mock API, your `.env` file should look like this:

    ```
    APP_ID=12345
    PRIVATE_KEY_PATH=test/fixtures/mock-cert.pem
    WEBHOOK_SECRET=dummy-secret
    REPO_CRAFTER_REQUIRE_AUTH=false
    USE_MOCK_API=true
    ```

2.  **Run the container:**

    ```bash
    # Run the container with the .env file
    docker run -d -p 3000:3000 --env-file .env repo-crafter
    ```

## Azure Deployment

This project includes Terraform configuration for Azure Web App deployment:

1. **Set up Azure Service Principal:**
   ```bash
   az ad sp create-for-rbac --name "repo-crafter-github-actions" --role contributor --scopes /subscriptions/{subscription-id} --sdk-auth
   ```

2. **Configure GitHub secrets** (see Repository Secrets section above)

3. **Deploy automatically** on push to main branch via GitHub Actions

## Helper Modules

The application uses modular helper functions:

- `types.ts` - TypeScript interface definitions
- `validation.ts` - Request parameter validation
- `github-app.ts` - GitHub App installation management
- `repository.ts` - Repository operations and validations
- `responses.ts` - Response formatting utilities

## Contributing

If you have suggestions for how repo-crafter could be improved, or want to report a bug, open an issue! For more information, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2025 aatmmr
