/*
Prerequisites:
1. GitHub Repository:
Ensure the repository has Dependabot enabled.
2. GitHub Token:
Use a GitHub token with repo scope for private repositories or limited permissions for public repositories.
3. Branch Protections:
Ensure the repository allows pushing to new branches for automated PR creation.


Dependabot provides automated security updates and vulnerability scanning.
To leverage these features, the workflow will:
1. Trigger a security analysis (if not already enabled).
2. Fetch security alerts for a repository.
3. Create pull requests to resolve detected vulnerabilities.
*/
const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios');


async function run() {
    try {
      const token = core.getInput('github_token');
      const language = core.getInput('language');
      const octokit = github.getOctokit(token);
  
      const { owner, repo } = github.context.repo;
  
      // Step 1: Enable security alerts for the repository
      core.info(`Enabling security alerts for ${owner}/${repo}...`);
      await octokit.request('PUT /repos/{owner}/{repo}/vulnerability-alerts', {
        owner,
        repo,
        mediaType: { previews: ['dorian'] }, // Required for Dependabot alerts
      });
  
      // Step 2: Fetch security alerts
      core.info(`Fetching security alerts for ${owner}/${repo}...`);
      const alerts = await octokit.request('GET /repos/{owner}/{repo}/dependabot/alerts', {
        owner,
        repo,
      });
  
      if (!alerts.data || alerts.data.length === 0) {
        core.info('No security vulnerabilities found.');
        return;
      }
  
      // Step 3: Process alerts and create pull requests
      const pullRequests = [];
      for (const alert of alerts.data) {
        if (alert.state === 'open' && alert.fixable) {
          const branchName = `dependabot/${alert.dependency.package}/security-fix`;
          core.info(`Creating pull request for ${alert.dependency.package}...`);
  
          // Create a branch
          await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
            owner,
            repo,
            ref: `refs/heads/${branchName}`,
            sha: github.context.sha,
          });
  
          // Commit fixes to the branch
          // (Assumes fix can be applied by running a command, adjust as needed for your language)
          // For example, for Node.js: `npm audit fix` or specific manual changes
  
          // Create a pull request
          const pr = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
            owner,
            repo,
            title: `Security fix for ${alert.dependency.package}`,
            head: branchName,
            base: 'main',
            body: `Fixes the following security vulnerability:\n\n- ${alert.dependency.package}\n\n**Severity**: ${alert.severity}\n\n**Advisory**: ${alert.advisory}`,
          });
  
          pullRequests.push(pr.data.html_url);
        }
      }  //end step 3
  
      core.setOutput('status', 'success');

    } catch (error) {
      core.setFailed(`Action failed: ${error.message}`);
    }
  }
  
  run();