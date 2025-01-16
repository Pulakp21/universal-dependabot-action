const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    const token = core.getInput('github_token');
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

    // Set the output for alerts_processed
    core.setOutput('alerts_processed', alerts.length);

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
      console.error('Vulnerability alerts are not supported for this repository or insufficient permissions.');
    } else if (error.status === 404) {
      console.error("Repository not found or invalid token.");
    } else {
      console.error(`Unexpected error: ${error.message}`);
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

    core.info(`Started pull request for ${alert.dependency.package}......`);

    core.info(`state:: ${alert.state} fixable:: ${alert.fixable}......`);

    const { number, security_advisory, dependency } = alert;

    if (alert.state === 'open') {
      const branchName = `dependabot/${alert.dependency.package}/security-fix`;
      core.info(`Creating pull request for ${alert.dependency.package}...`);

      // Create a branch
      await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: github.context.sha,
      });

      // Create a pull request
      const pr = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
        owner,
        repo,
        title: `Security fix for ${alert.dependency.package}`,
        head: branchName,
        base: 'main', // Adjust as needed
        body: `Fixes the following security vulnerability:\n\n- ${alert.dependency.package}\n\n**Severity**: ${alert.severity}\n\n**Advisory**: ${alert.advisory}\n\n- **Summary**: ${security_advisory.summary}\N\n Fixes #${number}`,
      });

      // body: `### Security Fix\n\n- **Package**: ${dependency.package}\n- **Severity**: ${security_advisory.severity}\n- **Summary**: ${security_advisory.summary}\n\nFixes #${number}`,
   

      pullRequests.push(pr.data.html_url);
      console.log(`Pull request created for ${dependency.package}.`);

    }
    core.info(`Completed pull request for ${alert.dependency.package}......`);
  }
  
}

run();