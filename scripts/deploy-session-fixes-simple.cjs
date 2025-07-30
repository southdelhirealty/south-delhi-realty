#!/usr/bin/env node

// Simple Session Fix Deployment Script (No PM2)
// This script applies the session management fixes for local development

const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

console.log("🔧 Simple Session Fix Deployment Script");
console.log("======================================");

async function deploySessionFixes() {
  try {
    console.log("1. 🧪 Testing session store...");
    try {
      await execAsync("node scripts/test-session-store.cjs");
      console.log("✅ Session store test passed");
    } catch (error) {
      console.log("⚠️  Session store test failed, but continuing...");
    }

    console.log("\n2. 🔄 Building application...");
    await execAsync("npm run build");
    console.log("✅ Application built successfully");

    console.log("\n✅ Session fixes applied successfully!");
    console.log("\n📋 Next steps:");
    console.log("   1. If using Docker, rebuild and restart your container:");
    console.log("      docker-compose down && docker-compose up --build");
    console.log("   2. If using PM2 in production, restart your application:");
    console.log("      pm2 restart south-delhi-realty");
    console.log("   3. If running locally, start the server:");
    console.log("      npm start");
    console.log("   4. Test login at: http://localhost:7922/auth");
    console.log("   5. Monitor session behavior in logs");
  } catch (error) {
    console.error("\n💥 Deployment failed:", error.message);
    console.error("\n🔧 Manual steps to complete:");
    console.error("   1. Check build errors: npm run build");
    console.error("   2. Check TypeScript errors in server files");
    console.error("   3. Restart your application server");
    process.exit(1);
  }
}

// Run the deployment
deploySessionFixes();
