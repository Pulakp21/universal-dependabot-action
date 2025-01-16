# universal-dependabot-action
# Prerequisites

1. **GitHub Repository**  
   Ensure the repository has Dependabot enabled.

2. **GitHub Token**  
   Use a GitHub token with `repo` scope for private repositories or limited permissions for public repositories.

3. **Branch Protections**  
   Ensure the repository allows pushing to new branches for automated PR creation.

---

# Dependabot Security Features

Dependabot provides automated security updates and vulnerability scanning.  
To leverage these features, the workflow will:

1. Trigger a security analysis (if not already enabled).  
2. Fetch security alerts for a repository.  
3. Create pull requests to resolve detected vulnerabilities.