# 📱 Table AI Mobile - Dynamic Buttons

## 🎯 Overview

Table AI Mobile now supports **dynamic buttons** from your Google Sheets! This means any button you create in your spreadsheet will automatically appear in the mobile app with full functionality.

## ✨ New Features

### 🎯 Dynamic Menu
- **Auto-detection**: Automatically finds all images with assigned scripts
- **Rich metadata**: Icons, descriptions, categories
- **Touch-friendly**: Optimized for mobile interaction
- **Real-time**: Execute functions directly from mobile

### 🛠️ Easy Configuration
- **Visual setup**: Use "Мобильные кнопки" menu to configure
- **JSON metadata**: Rich button properties in alt-text
- **Bulk editing**: ButtonConfig sheet for batch operations
- **Preview**: Test buttons before deployment

### 📱 Mobile Experience
- **Category grouping**: Buttons organized by type
- **Visual feedback**: Loading states and results
- **Error handling**: Clear error messages
- **History tracking**: All actions logged

## 🚀 Quick Start

### 1. Deploy Apps Script
1. Open Google Sheet → Extensions → Apps Script
2. Click **Deploy** → **New deployment**
3. Select **Web app**, **Execute as: Me**, **Anyone**
4. Copy the Web app URL

### 2. Configure Mobile App
1. Open Table AI mobile web app
2. Go to **Settings** → **Apps Script Web App**
3. Paste the Web app URL
4. Click **Save URL**

### 3. Set Up Buttons
1. In Google Sheet, go to **🤖 Table AI** → **Мобильные кнопки**
2. Review auto-detected buttons in ButtonConfig sheet
3. Edit icons, labels, descriptions, categories
4. Run **Применить метаданные**

### 4. Use Mobile Buttons
1. Open mobile app → **Кнопки таблицы**
2. Tap any button to execute
3. View results in mobile-friendly dialogs

## 📋 Button Metadata

### Basic Format
Add this to image alt-text for rich metadata:

```json
{
  "icon": "🤖",
  "label": "AI Constructor",
  "description": "Create AI-powered prompts",
  "category": "ai",
  "order": 1
}
```

### Available Fields
- **icon**: Emoji or image URL
- **label**: Display name (required)
- **description**: Help text
- **category**: Group (ai, data, tools, etc.)
- **order**: Sort order (lower numbers first)
- **imageUrl**: Custom icon URL

### Category Examples
- `ai`: AI functions, prompts, generation
- `data`: Import/export, data processing
- `tools`: Utilities, helpers, settings
- `reports`: Charts, summaries, analytics

## 🔧 Advanced Usage

### Function Parameters
Some functions need input. Mobile app will show input dialog:

```json
{
  "function": "processData",
  "parameters": ["text_input"],
  "label": "Process Text Data"
}
```

### Custom Images
Use custom icons instead of emojis:

```json
{
  "icon": "📊",
  "imageUrl": "https://yoursite.com/custom-icon.png",
  "label": "Custom Report"
}
```

### Conditional Buttons
Create context-aware buttons:

```json
{
  "function": "smartAction",
  "condition": "cell_not_empty",
  "label": "Smart Action"
}
```

## 📊 API Reference

### Web App Actions

#### Get Buttons
```javascript
fetch(webAppUrl, {
  method: 'POST',
  body: JSON.stringify({
    action: 'exportButtonsJSON'
  })
})
```

#### Execute Function
```javascript
fetch(webAppUrl, {
  method: 'POST',
  body: JSON.stringify({
    action: 'callFunction',
    functionName: 'myFunction',
    args: ['param1', 'param2']
  })
})
```

#### Read Sheet Data
```javascript
fetch(webAppUrl, {
  method: 'POST',
  body: JSON.stringify({
    action: 'getSheetData',
    sheetName: 'Sheet1',
    range: 'A1:C10'
  })
})
```

## 🎨 UI Components

### Button States
- **Default**: Icon, label, description
- **Loading**: Spinner animation
- **Success**: Checkmark feedback
- **Error**: Error message display

### Category Headers
- **Russian**: Localized category names
- **Icons**: Visual category indicators
- **Sorting**: Alphabetical by default

### Result Display
- **Text**: Preformatted text blocks
- **JSON**: Syntax-highlighted code
- **HTML**: Rendered in web view
- **Images**: Full-screen preview

## 🔒 Security

### Web App Permissions
- **Execute as**: Your Google account
- **Access**: Anyone with link
- **Scope**: Spreadsheet access only

### Data Protection
- **No storage**: Mobile app doesn't store data
- **Context**: Functions run with sheet permissions
- **Logging**: All actions logged in sheet

## 🚨 Troubleshooting

### Common Issues

**"No buttons found"**
- Check images have assigned scripts
- Verify alt-text contains metadata
- Use "Мобильные кнопки" to setup

**"Function not found"**
- Verify function name in metadata
- Check function exists in Main.gs
- Test function in spreadsheet first

**"Web App error"**
- Check deployment permissions
- Verify Web App URL in settings
- Review Apps Script logs

**"Permission denied"**
- Re-deploy with correct permissions
- Check account access to sheet
- Verify "Anyone" access setting

### Debug Mode
Add `?debug=true` to mobile app URL for:
- Console logging
- Request/response details
- Error stack traces

## 📈 Performance

### Optimization Tips
1. **Order buttons**: Put important ones first
2. **Use categories**: Group related functions
3. **Optimize images**: Small, fast-loading icons
4. **Limit buttons**: Focus on essential functions

### Monitoring
- **Logs**: Check spreadsheet logs
- **Usage**: Monitor button clicks
- **Performance**: Track response times
- **Errors**: Review failure patterns

## 🎉 Success Stories

### Use Cases
- **Field teams**: Data collection on mobile
- **Managers**: Quick report generation
- **Analysts**: Import/export workflows
- **Sales teams**: CRM integration

### Benefits
- **Unified**: Same functions everywhere
- **Mobile**: Work from any device
- **Flexible**: Custom button workflows
- **Secure**: Enterprise-ready permissions

---

## 📞 Support

For help with dynamic buttons:
1. 📖 Read deployment guide
2. 🧪 Test with sample buttons
3. 📝 Check Apps Script logs
4. 📱 Review mobile console

**Table AI Mobile** - Your spreadsheet, everywhere! 🚀