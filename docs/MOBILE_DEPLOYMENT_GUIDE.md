# 🚀 Deployment Guide: Dynamic Mobile Buttons for Table AI

## 📋 Overview

This guide shows how to deploy the Table AI Apps Script as a Web App to enable dynamic button functionality in the mobile client.

## 🔧 Prerequisites

1. ✅ Google Account with access to the Table AI spreadsheet
2. ✅ Apps Script deployed with the new mobile API functions
3. ✅ Mobile client configured with Web App URL

## 📝 Step-by-Step Deployment

### 1. Open Apps Script Editor

1. Open your Google Sheet with Table AI
2. Go to `Extensions` → `Apps Script`
3. Verify you see the updated Main.gs with mobile API functions

### 2. Deploy as Web App

1. In the Apps Script editor, click **Deploy** → **New deployment**
2. Select type: **Web app**
3. Configure deployment settings:
   - **Description**: `Table AI Mobile API`
   - **Execute as**: `Me` (your account)
   - **Who has access**: `Anyone`
4. Click **Deploy**
5. **Authorize** the permissions when prompted
6. **Copy the Web app URL** (starts with `https://script.google.com/macros/s/.../exec`)

### 3. Configure Mobile Client

1. Open the Table AI mobile web app
2. Go to **Settings** → **Apps Script Web App**
3. Paste the Web app URL from step 2
4. Click **Save URL**

### 4. Test Dynamic Buttons

1. Go back to main menu
2. Click **Кнопки таблицы** (Table Buttons)
3. You should see all buttons from your spreadsheet
4. Click any button to test the functionality

## 🎯 Setting Up Button Metadata

### Method 1: Automatic Detection

The system automatically detects:
- Images with assigned scripts
- Alt-text descriptions
- Basic metadata

### Method 2: Manual Configuration

1. In your Google Sheet, run `setupButtonMetadata()` function
2. This creates a "ButtonConfig" sheet with all detected buttons
3. Edit the metadata in this sheet:
   - **Icon**: Emoji or image URL
   - **Label**: Display name
   - **Description**: Help text
   - **Category**: Group buttons (ai, data, tools, etc.)
   - **Order**: Sort order (lower numbers first)

4. Run `applyButtonMetadata()` to apply changes

### Method 3: Manual Alt-Text Setup

For each button image in your sheet:

1. Right-click the image → **Assign script** (if not already assigned)
2. Right-click the image → **Alt text**
3. Enter JSON metadata:

```json
{
  "icon": "🤖",
  "label": "AI Constructor", 
  "description": "Create AI-powered prompts",
  "category": "ai",
  "order": 1,
  "imageUrl": "https://example.com/icon.png"
}
```

## 📱 Mobile Features

### Dynamic Menu Display

- **Grouped by Category**: Buttons organized by type
- **Visual Icons**: Emojis or custom images
- **Rich Metadata**: Descriptions and locations
- **Touch-Friendly**: Optimized for mobile interaction

### Function Execution

- **Secure**: All calls go through your Web App
- **Context-Aware**: Functions run with full spreadsheet access
- **Real-time**: Immediate feedback and results
- **Error Handling**: Clear error messages and retry options

### Result Display

- **Formatted Output**: Clean presentation of results
- **Interactive**: Modal dialogs for complex responses
- **Logging**: All actions tracked in history
- **Fallback**: Graceful handling of different response types

## 🔧 Advanced Configuration

### Custom Categories

Define custom categories in button metadata:

```json
{
  "category": "custom_reports",
  "icon": "📊",
  "label": "Monthly Report"
}
```

### Image Support

Use custom icons:
```json
{
  "icon": "🔘",
  "imageUrl": "https://yoursite.com/custom-icon.png",
  "label": "Custom Action"
}
```

### Function Parameters

Some functions may need parameters. The mobile client will show an input dialog:

```json
{
  "function": "myCustomFunction",
  "parameters": ["text_input", "date_range"],
  "label": "Custom Function"
}
```

## 🚨 Troubleshooting

### Common Issues

**"URL не настроен" (URL not configured)**
- Solution: Deploy Web App and configure URL in mobile settings

**"Function not found"**
- Solution: Ensure function exists in Main.gs and is properly named

**"Permission denied"**
- Solution: Re-deploy Web App with correct permissions

**"No buttons found"**
- Solution: Check that images have assigned scripts or alt-text

### Debug Mode

Enable debug logging:
1. In mobile settings, add `?debug=true` to URL
2. Check browser console for detailed logs
3. Review Apps Script execution logs

### Performance Optimization

For large spreadsheets:
1. Use `order` field to prioritize important buttons
2. Group related functions with `category`
3. Limit high-frequency operations
4. Cache results where appropriate

## 🔄 Updates and Maintenance

### Adding New Buttons

1. Add image to spreadsheet
2. Assign script function
3. Set alt-text metadata
4. Mobile client auto-detects on next load

### Updating Functions

1. Modify function in Main.gs
2. Save changes
3. Mobile client uses updated version immediately

### Changing Web App URL

1. Deploy new version of Apps Script
2. Update URL in mobile settings
3. All mobile clients will use new endpoint

## 📚 API Reference

### doPost Actions

#### `exportButtonsJSON`
Returns all buttons with metadata:
```json
{
  "ok": true,
  "data": "[{\"sheet\":\"Sheet1\",\"cell\":\"A1\",\"function\":\"myFunction\",...}]"
}
```

#### `callFunction`
Execute a spreadsheet function:
```json
{
  "action": "callFunction",
  "functionName": "myFunction",
  "args": ["param1", "param2"]
}
```

#### `getSheetData`
Read sheet data:
```json
{
  "action": "getSheetData", 
  "sheetName": "Sheet1",
  "range": "A1:C10"
}
```

## 🎉 Success Indicators

✅ **Working**: Buttons appear, functions execute, results display  
⚠️ **Partial**: Buttons load but some functions fail  
❌ **Broken**: No buttons or Web App errors  

## 📞 Support

For deployment issues:
1. Check Apps Script execution logs
2. Verify Web App deployment settings  
3. Test with simple functions first
4. Review mobile browser console

---

*This guide covers the complete deployment and configuration process for Table AI mobile dynamic buttons functionality.*