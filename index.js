const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    const token = core.getInput('github_token');
    const octokit = github.getOctokit(token);

    const { owner, repo } = github.context.repo;


    // Step 1: Enable Vulnerability Alerts
    await enableVulnerabilityAlerts(octokit, owner, repo);

    await enableDependabotSecurityUpdates(octokit, owner, repo);

    // Step 2: Fetch Security Alerts
    const alerts = await fetchSecurityAlerts(octokit, owner, repo);
    console.log(`Found ${alerts.length} security alerts.`);


    if (alerts.length > 0) {

      for (const alert of alerts) {
        const ecosystem = alert.dependency.package.ecosystem;
        const manifestPath = alert.dependency.manifest_path;

        console.log(`Processing alert for ${manifestPath} in ecosystem ${ecosystem}`);

        // step 3: For each alert, create a security update 
        const update = await createSecurityUpdate(octokit, owner, repo, ecosystem, manifestPath);
        console.log(`update :: ${update} `);
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
      // Check if Vulnerability alerts are enabled
    await octokit.request('GET /repos/{owner}/{repo}/vulnerability-alerts', {
      owner,
      repo,
      mediaType: { previews: ['dorian'] },
    });
    console.log("Vulnerability alerts are already enabled.");
  } catch(error){
    if (error.status === 403) {
      console.error('Vulnerability alerts are not supported for this repository or insufficient permissions.');
    } else if (error.status === 404) {
      console.log("Enabling Vulnerability alerts...");
      await octokit.request('PUT /repos/{owner}/{repo}/vulnerability-alerts', {
        owner,
        repo,
        mediaType: { previews: ['dorian'] },
      });
      console.log("Vulnerability alerts enabled.")
    } else {
      console.error("Failed to check or enable Vulnerability alerts:", error.message);
      throw error;
    }
  }
}


async function enableDependabotSecurityUpdates(octokit, owner, repo) {
  try {
      // Check if Dependabot is configured by verifying its public key endpoint
    await octokit.request('GET /repos/{owner}/{repo}/dependabot/secrets/public-key', {
      owner,
      repo,
    });
    console.log("Dependabot security updates are already enabled.");

  }catch(error){
    if (error.status === 403) {
      console.error(
        'Failed to enable Dependabot security updates: Insufficient permissions or feature not supported for this repository.'
      );
    } else if (error.status === 404) {

      console.log("Enabling Dependabot security updates...");
      await octokit.request('PUT /repos/{owner}/{repo}/dependabot/security-updates', {
        owner,
        repo,
        mediaType: { previews: ['dorian'] },
      });
      console.log("Dependabot security updates enabled.");
    } else {
      console.error("Failed to check or enable Dependabot security updates:", error.message);
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
  console.log(response);
  return response.data; // Array of security alerts
}

async function createSecurityUpdate(octokit, owner, repo, ecosystem, manifestPath) {
  try {
    console.log(`Creating security update for ecosystem: ${ecosystem}, manifestPath: ${manifestPath}`);
    
    const response = await octokit.request('POST /repos/{owner}/{repo}/dependabot/security-updates', {
      owner,
      repo,
      security_update: {
        package_ecosystem: ecosystem,
        manifest: manifestPath,
      },
    });
    console.log(`Security update created for ${manifestPath}: ${response.status}`);
    console.log(response);
    return response.data;
  } catch (error) {
    console.log(error);
    if (error.status === 404) {
      console.error(`Manifest file not found or no security updates available for ${manifestPath}.`);
    } else if (error.status === 403) {
      console.error(`Insufficient permissions to create security update for ${manifestPath}.`);
    } else {
      console.error(`Failed to create security update for ${manifestPath}: ${error.message}`);
    }
    return null;
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
    console.log(response);
    return response.data;
  } catch (error) {
    console.log(error);
    console.error(`Failed to create pull request for branch ${branch}:`, error.message);
  }
}

run();