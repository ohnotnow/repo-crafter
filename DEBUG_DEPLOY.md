# Debug Deployment Checklist

Follow these steps to pick up the logging-heavy branch and ship it to Azure.

## 1. Clone the Fork
```bash
git clone https://github.com/ohnotnow/repo-crafter.git
cd repo-crafter
```
The remote `origin` is already configured to point at the fork; no extra setup required.

## 2. Check Out the Debug Branch
```bash
git fetch origin
git checkout debug/logging
git pull origin debug/logging
```
The final command ensures the local branch matches the latest remote changes.

## 3. Local Smoke Checks
```bash
npm ci
npm run build
npm test
```
Running the build verifies the TypeScript compiles and the tests confirm the Probot app still boots. Logging defaults to `trace` automatically when `LOG_LEVEL` is unset, so no additional environment variables are needed.

## 4. Build the Docker Image
```bash
docker build -t repo-crafter:debug-logging .
```
Tag the image with something meaningful (e.g., `repo-crafter:debug-logging`). Add `--push` or a subsequent `docker push` if you're publishing to an Azure Container Registry (ACR).

## 5. Deploy to Azure
1. Push the image to ACR, or let your pipeline build from this branch.
2. Update the App Service / Container App to use the new image or branch.
3. Confirm application settings include the GitHub App credentials and Repo Crafter secrets. `LOG_LEVEL` can remain empty—the app now defaults to `trace` if it’s unset.

## 6. Monitor Logs
- App Service: `az webapp log tail --name <app> --resource-group <rg>`
- Container Apps: `az containerapp logs show --name <app> --resource-group <rg>`
- Application Insights: query by `requestId` emitted in each log entry.

This branch is safe to roll back—reverting to the previous image will restore prior logging levels.
