#!/bin/bash
set -e

echo "🚀 TESTING CLASP SETUP FOR CURRENT DEPLOY CODE"
echo "=================================================="
echo ""

echo "1. ✅ Check .clasp.json configuration:"
if [ -f .clasp.json ]; then
  echo "   📄 .clasp.json exists"
  cat .clasp.json
else
  echo "   ❌ .clasp.json missing"
  exit 1
fi
echo ""

echo "2. ✅ Check rootDir (deploy/) contents:"
ROOTDIR=$(cat .clasp.json | jq -r '.rootDir')
echo "   📁 Root directory: $ROOTDIR"

if [ -d "$ROOTDIR" ]; then
  echo "   📋 Files to deploy:"
  find "$ROOTDIR" -name "*.gs" -o -name "*.html" -o -name "*.json" | sort
  echo ""
  
  echo "   📊 File count:"
  GS_COUNT=$(find "$ROOTDIR" -name "*.gs" | wc -l)
  HTML_COUNT=$(find "$ROOTDIR" -name "*.html" | wc -l) 
  JSON_COUNT=$(find "$ROOTDIR" -name "*.json" | wc -l)
  
  echo "     - .gs files: $GS_COUNT"
  echo "     - .html files: $HTML_COUNT" 
  echo "     - .json files: $JSON_COUNT"
else
  echo "   ❌ Root directory does not exist"
  exit 1
fi
echo ""

echo "3. ✅ Check appsscript.json validity:"
APPSSCRIPT_FILE="$ROOTDIR/appsscript.json"
if [ -f "$APPSSCRIPT_FILE" ]; then
  echo "   📄 Found: $APPSSCRIPT_FILE"
  if jq empty "$APPSSCRIPT_FILE" 2>/dev/null; then
    echo "   ✅ JSON is valid"
    echo "   📋 Configuration:"
    cat "$APPSSCRIPT_FILE" | jq .
  else
    echo "   ❌ JSON is invalid"
    cat "$APPSSCRIPT_FILE"
    exit 1
  fi
else
  echo "   ❌ appsscript.json not found in $ROOTDIR"
  exit 1
fi
echo ""

echo "4. ✅ Check .claspignore configuration:"
if [ -f .claspignore ]; then
  echo "   📄 .claspignore exists"
  echo "   📋 Ignored patterns:"
  head -10 .claspignore
else
  echo "   ⚠️  .claspignore not found (will deploy all files)"
fi
echo ""

echo "5. ✅ Script ID validation:"
SCRIPT_ID=$(cat .clasp.json | jq -r '.scriptId')
echo "   📋 Script ID: $SCRIPT_ID"
if [ ${#SCRIPT_ID} -gt 30 ]; then
  echo "   ✅ Script ID length looks correct (${#SCRIPT_ID} chars)"
else
  echo "   ⚠️  Script ID seems short (${#SCRIPT_ID} chars)"
fi
echo ""

echo "=================================="
echo "🎉 CLASP SETUP VALIDATION COMPLETE"
echo "=================================="
echo ""
echo "📝 READY TO DEPLOY:"
echo "   clasp push    # Deploy files to Apps Script"
echo "   clasp open    # Open project in web editor" 
echo ""
echo "🔧 MANUAL STEPS NEEDED:"
echo "   1. Run: clasp login (if not authenticated)"
echo "   2. Run: clasp push"
echo "   3. Test the deployed code in Apps Script editor"
echo ""