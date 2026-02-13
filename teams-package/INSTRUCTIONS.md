# Microsoft Teams Integration Setup Guide

## 1. Redeploy Your Web App
First, assure that your latest code (with the `/teams` route) is deployed to `https://tdo.ebsteqrix.com`.

## 2. Register Application in Azure AD (Entra ID)
To enable "Sign in with Microsoft", you need an App Registration.

1.  Go to [Azure Portal > App registrations](https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps).
2.  Click **New registration**.
    -   **Name**: `TeamToDo`
    -   **Supported account types**: "Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)" (Recommended for Teams apps)
    -   **Redirect URI**: select **Web** and enter:
        `https://cloud.appwrite.io/v1/account/sessions/oauth2/callback/microsoft/698ce9a3002b537b3451`
        *(This is your Appwrite Project Callback URL)*
3.  Click **Register**.
4.  Copy the **Application (client) ID**. You'll need this for Appwrite.
5.  Go to **Certificates & secrets** (sidebar).
    -   Click **New client secret**.
    -   Add a description and expiry.
    -   Copy the **Value** (not the ID) immediately. You'll need this for Appwrite.

## 3. Configure Appwrite Auth
1.  Go to your [Appwrite Console](https://cloud.appwrite.io/console/project-698ce9a3002b537b3451/auth/settings).
2.  Navigate to **Auth > Settings > OAuth2 Providers**.
3.  Find **Microsoft** and enable it.
4.  Paste the **App ID** (Client ID) and **App Secret** (Client Secret) from Azure.
5.  Save changes.

## 4. Package & Upload to Teams
1.  Navigate to the `teams-package` folder on your computer.
2.  Select `manifest.json`, `color.png`, and `outline.png`.
3.  **Zip them together** into `teamtodo-app.zip`.
4.  Go to the [Teams Developer Portal](https://dev.teams.microsoft.com/apps).
5.  Click **Import app** and select your zip file.
6.  Navigate to **App features** -> **Personal app** -> Verify the content URL is `https://tdo.ebsteqrix.com/teams`.
7.  Click **Publish** -> **Publish to your Org**.

Your Teams App is now ready! Users in your organization can install it and sign in using their Microsoft accounts.
