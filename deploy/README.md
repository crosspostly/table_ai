# Deploy folder

All client-side Google Apps Script files.

## Files

- **Main.gs** - Main UI and logic
- **CollectConfig.gs** - Config handler
- **TemplateService.gs** - Templates
- **VK.gs** - VK API integration
- **ocr.gs** - Server-side OCR microservice (separate deployment)
- **CollectConfigUi.html** - Settings UI
- **SettingsUI.html** - User settings
- **appsscript.json** - Script manifest

## Notes

- These files are automatically updated via OTA system
- Users should NOT edit these files manually
- Updates happen nightly at 3:00 AM UTC

For development, see ../docs/DEPLOYMENT.md
