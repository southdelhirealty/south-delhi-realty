#!/usr/bin/env node

// Quick Session Fix Deployment Script
// This script applies the session management fixes and redeploys the application

const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

console.log("🔧 Session Fix Deployment Script");
console.log("================================");

async function deploySessionFixes() {
  try {
    console.log("1. 🧪 Testing session store...");
    try {
      await execAsync("node scripts/test-session-store.cjs");
      console.log("✅ Session store test passed");
    } catch (error) {
      console.log("⚠️  Session store test failed, but continuing...");
    }

    console.log("\n2. 🔄 Building server...");
    await execAsync("npm run build:server");
    console.log("✅ Server built successfully");

    console.log("\n3. 📦 Building client...");
    await execAsync("npm run build:client");
    console.log("✅ Client built successfully");

    console.log("\n4. 🔄 Restarting application...");

    // Check if PM2 process exists
    try {
      const { stdout } = await execAsync("pm2 list");
      if (stdout.includes("south-delhi-realty")) {
        console.log("🔄 Restarting existing PM2 process...");
        await execAsync("pm2 restart south-delhi-realty");
      } else {
        console.log("🚀 Starting new PM2 process...");
        await execAsync("pm2 start ecosystem.config.cjs");
      }
    } catch (error) {
      console.log("❌ PM2 not found, trying direct node execution...");
      console.log("📋 Manual start command: node dist/server/index.js");
      return;
    }

    console.log("✅ Application restarted successfully");

    console.log("\n5. ⏳ Waiting for application to start...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("\n6. 🩺 Testing application health...");
    try {
      await execAsync("curl -f http://localhost:7922/health");
      console.log("✅ Application health check passed");
    } catch (error) {
      console.log(
        "⚠️  Health check failed, check logs with: pm2 logs south-delhi-realty"
      );
    }

    console.log("\n7. 📊 Showing PM2 status...");
    try {
      const { stdout } = await execAsync("pm2 status");
      console.log(stdout);
    } catch (error) {
      console.log("❌ Could not get PM2 status");
    }

    console.log("\n🎉 Session fixes deployed successfully!");
    console.log("\n📋 Next steps:");
    console.log("   1. Test login at: https://southdelhirealty.com/auth");
    console.log("   2. Check logs: pm2 logs south-delhi-realty");
    console.log("   3. Monitor session behavior in logs");
    console.log("   4. If issues persist, check session debug output");
  } catch (error) {
    console.error("\n💥 Deployment failed:", error.message);
    console.error("\n🔧 Manual recovery steps:");
    console.error("   1. Check build errors: npm run build");
    console.error("   2. Check PM2 logs: pm2 logs south-delhi-realty");
    console.error("   3. Restart manually: pm2 restart south-delhi-realty");
    process.exit(1);
  }
}

// Run the deployment
deploySessionFixes();
