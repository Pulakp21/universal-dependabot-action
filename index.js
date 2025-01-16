const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios');
const path = require('path');
const yaml = require('js-yaml');

async function run() {
  try {
    const token = core.getInput('github_token');
    const repoPath = core.getInput('repo_path') || '.';
    const octokit = github.getOctokit(token);

    const { owner, repo } = github.context.repo;


    // Step 1: Enable Vulnerability Alerts
    await enableVulnerabilityAlerts(octokit, owner, repo);

    // Step 2: Fetch Security Alerts
    const alerts = await fetchSecurityAlerts(octokit, owner, repo);
    console.log(`Found ${alerts.length} security alerts.`);

    // Step 3: Create Pull Requests for Alerts
    if (alerts.length > 0) {
      await createPullRequestsForAlerts(octokit, owner, repo, alerts);
    } else {
      console.log('No security alerts found.');
    }

  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

async function enableVulnerabilityAlerts(octokit, owner, repo) {
  try {
    await octokit.request('PUT /repos/{owner}/{repo}/vulnerability-alerts', {
      owner,
      repo,
      mediaType: { previews: ['dorian'] },
    });
    console.log('Vulnerability alerts enabled.');
  } catch (error) {
    if (error.status === 403) {
      console.error('Vulnerability alerts are not supported for this repository.');
    } else {
      throw error;
    }
  }
}

async function fetchSecurityAlerts(octokit, owner, repo) {
  const response = await octokit.request('GET /repos/{owner}/{repo}/dependabot/alerts', {
    owner,
    repo,
    mediaType: { previews: ['dorian'] },
  });
  return response.data; // Array of security alerts
}

async function createPullRequestsForAlerts(octokit, owner, repo, alerts) {
  for (const alert of alerts) {
    const { number, security_advisory, dependency } = alert;
    const branchName = `dependabot-fix-${dependency.package}`;

    // Example PR creation logic
    await octokit.request('POST /repos/{owner}/{repo}/pulls', {
      owner,
      repo,
      title: `Fix: Security vulnerability in ${dependency.package}`,
      head: branchName,
      base: 'main', // Adjust as needed
      body: `### Security Fix\n\n- **Package**: ${dependency.package}\n- **Severity**: ${security_advisory.severity}\n- **Summary**: ${security_advisory.summary}\n\nFixes #${number}`,
    });
    console.log(`Pull request created for ${dependency.package}.`);
  }
}

run();