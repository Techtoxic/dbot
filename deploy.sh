#!/bin/bash

echo "🚀 Deploying Deriv Bot to Netlify..."
echo "App ID: 88245"
echo "Domain: dectrading.netlify.app"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "🔨 Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful!"
echo ""
echo "📁 Built files are in the 'dist/' directory"
echo ""
echo "🌐 Next steps:"
echo "1. Go to netlify.com"
echo "2. Drag and drop the 'dist/' folder"
echo "3. Or connect your GitHub repo for auto-deployment"
echo ""
echo "🎯 Your site will be available at: dectrading.netlify.app"
echo "💰 Commission tracking with App ID 88245 is active!"
echo ""
echo "✅ Ready for deployment!"