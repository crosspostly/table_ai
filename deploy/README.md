# Deploy Folder

This folder contains all the Google Apps Script files required for the client-side deployment of Table AI.

## 📂 File Structure

### Core Logic
- **`Main.gs`**: The entry point for the application. Contains menu creation, global utilities, and client-side orchestration.
- **`SocialImport.gs`**: Handles importing posts from Telegram, VK, and Instagram. See [SOCIAL_IMPORT.md](../docs/SOCIAL_IMPORT.md).
- **`CollectConfig.gs`**: Manages AI transformation configurations.
- **`TemplateService.gs`**: Handles saving and loading of user prompts/templates.
- **`ota_updates.gs`**: Logic for Over-The-Air updates (checking versions, applying patches).

### Server & License
- **`server.gs`**: (Server-side) Handles licensing, OTA distribution, and API proxying.
- **`license.gs`**: Logic for validating user licenses.

### UI & HTML
- **`CollectConfigUi.html`**: The main interface for the AI Constructor.
- **`SettingsUI.html`**: User settings dialog.
- **`UnpackingViewerUI.html`**: Interface for viewing unpacked data.
- **`logging_system.html`**: HTML template for viewing logs.

### Specialized Modules
- **`VK.gs`**: Specific integration functions for VKontakte API.
- **`ocrRunV2_client.gs`**: Client-side logic for OCR (Optical Character Recognition) tasks.
- **`reniewcell.gs`**: Utility for refreshing/recalculating specific cells.
- **`DevTools.gs`**: Development and debugging utilities (excluded from production builds typically).

### Configuration
- **`appsscript.json`**: The manifest file defining scopes, timezone, and dependencies.

## 🚀 Deployment

- **Automatic Updates**: These files are automatically distributed to clients via the OTA system.
- **Manual Update**: Users can copy these files into their Apps Script project manually if OTA is disabled.
- **Do Not Edit**: Users should generally **NOT** edit these files manually, as changes will be overwritten by the next update.

For detailed deployment instructions, please refer to:
- **[Main Deployment Guide](../docs/DEPLOYMENT.md)** (Recommended)
- *Legacy Guide: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)*

## 🔄 Versioning

- **Server Version**: Defined in `server.gs`.
- **Client Version**: Defined in `Main.gs`.
- Updates are typically scheduled nightly at 3:00 AM UTC.