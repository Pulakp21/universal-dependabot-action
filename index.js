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


    if (alerts.length > 0) {

      for (const alert of alerts) {
        const ecosystem = alert.package_ecosystem;
        const manifestPath = alert.manifest_path;

        console.log(`Processing alert for ${manifestPath} in ecosystem ${ecosystem}`);

        // step 3: For each alert, create a security update 
        const update = await createSecurityUpdate(octokit, owner, repo, ecosystem, manifestPath);

        if (update) {
          // Step 4: Create Pull Requests for Alerts
          await createPullRequest(octokit, owner, repo, update.branch, baseBranch);
        } else {
          console.log(`failed to security updates for ${manifestPath} in ecosystem ${ecosystem}`);
        }

      }
      // await createPullRequestsForAlerts(octokit, owner, repo, alerts);
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

async function createSecurityUpdate(octokit, owner, repo, ecosystem, manifestPath) {
  try {
    const response = await octokit.request('POST /repos/{owner}/{repo}/dependabot/security-updates', {
      owner,
      repo,
      security_update: {
        package_ecosystem: ecosystem,
        manifest: manifestPath,
      },
    });
    console.log(`Security update created for ${manifestPath}: ${response.status}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to create security update for ${manifestPath}:`, error.message);
  }
}

async function createPullRequest(octokit, owner, repo, branch, base) {
  try {
    const response = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
      owner,
      repo,
      title: `Security update: ${branch}`,
      head: branch,
      base,
      body: 'This pull request resolves security vulnerabilities.',
    });
    console.log(`Pull request created: ${response.data.html_url}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to create pull request for branch ${branch}:`, error.message);
  }
}

run();