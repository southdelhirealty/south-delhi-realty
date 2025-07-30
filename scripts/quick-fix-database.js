#!/usr/bin/env node

// Quick Fix Script for Database Connection Issues
// This script provides immediate solutions for ETIMEDOUT errors

const mysql = require("mysql2/promise");

console.log("🔧 South Delhi Realty - Database Connection Quick Fix");
console.log("================================================");

async function quickFix() {
  console.log("1. Testing current database connection...");

  const config = {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "southdelhirealestate",
    port: parseInt(process.env.DB_PORT || "3306"),
    connectTimeout: 10000,
    timeout: 5000,
  };

  try {
    const connection = await mysql.createConnection(config);
    await connection.execute("SELECT 1");
    console.log("✅ Database connection is working");
    await connection.end();

    console.log("\n2. Checking if application needs restart...");

    // Check if PM2 process exists
    const { exec } = require("child_process");

    exec("pm2 list | grep south-delhi-realty", (error, stdout, stderr) => {
      if (error) {
        console.log("❌ PM2 or application not found");
        console.log("📋 Manual steps needed:");
        console.log("   1. npm run build");
        console.log("   2. pm2 start ecosystem.config.cjs");
        return;
      }

      if (stdout.includes("south-delhi-realty")) {
        console.log("✅ Application found in PM2");
        console.log("🔄 Restarting application...");

        exec(
          "pm2 restart south-delhi-realty",
          (restartError, restartStdout) => {
            if (restartError) {
              console.log("❌ Failed to restart application");
              console.log(
                "📋 Manual restart needed: pm2 restart south-delhi-realty"
              );
              return;
            }

            console.log("✅ Application restarted successfully");
            console.log("⏳ Waiting for application to stabilize...");

            setTimeout(() => {
              console.log("🔍 Testing application health...");

              const http = require("http");
              const req = http.get("http://localhost:7922", (res) => {
                if (res.statusCode === 200) {
                  console.log("✅ Application is responding correctly");
                  console.log("🎉 Quick fix completed successfully!");
                } else {
                  console.log(
                    "⚠️  Application is responding but may have issues"
                  );
                  console.log("📋 Check logs: pm2 logs south-delhi-realty");
                }
              });

              req.on("error", (err) => {
                console.log("❌ Application is not responding");
                console.log("📋 Check logs: pm2 logs south-delhi-realty");
              });

              req.setTimeout(5000, () => {
                console.log("⏳ Application is taking time to respond");
                console.log("📋 Check logs: pm2 logs south-delhi-realty");
                req.destroy();
              });
            }, 5000);
          }
        );
      } else {
        console.log("❌ Application not found in PM2");
        console.log("📋 Start application: pm2 start ecosystem.config.cjs");
      }
    });
  } catch (error) {
    console.log("❌ Database connection failed");
    console.log("🔧 Applying quick fixes...");

    // Quick fix 1: Restart MySQL service
    console.log("\n🔄 Attempting to restart MySQL service...");
    const { spawn } = require("child_process");

    const restartMysql = spawn("sudo", ["systemctl", "restart", "mysql"], {
      stdio: "inherit",
    });

    restartMysql.on("close", (code) => {
      if (code === 0) {
        console.log("✅ MySQL service restarted successfully");

        // Test connection again
        setTimeout(async () => {
          console.log("🔄 Testing database connection again...");
          try {
            const connection = await mysql.createConnection(config);
            await connection.execute("SELECT 1");
            console.log("✅ Database connection is now working");
            await connection.end();

            console.log("🔄 Restarting application...");
            exec("pm2 restart south-delhi-realty", (restartError) => {
              if (restartError) {
                console.log("❌ Failed to restart application");
                console.log(
                  "📋 Manual restart needed: pm2 restart south-delhi-realty"
                );
              } else {
                console.log("✅ Application restarted successfully");
                console.log("🎉 Quick fix completed!");
              }
            });
          } catch (retryError) {
            console.log("❌ Database connection still failing");
            console.log("📋 Manual intervention needed");
            console.log(
              "🔧 Follow the troubleshooting guide: scripts/database-troubleshooting.md"
            );
          }
        }, 3000);
      } else {
        console.log("❌ Failed to restart MySQL service");
        console.log("📋 Try manually:");
        console.log("   sudo systemctl restart mysql");
        console.log("   sudo systemctl restart mariadb");
      }
    });

    restartMysql.on("error", (err) => {
      console.log("❌ Cannot restart MySQL service automatically");
      console.log("📋 Manual steps:");
      console.log("   1. sudo systemctl restart mysql");
      console.log("   2. Check database logs: sudo journalctl -u mysql");
      console.log("   3. Verify database configuration");
      console.log("   4. pm2 restart south-delhi-realty");
    });
  }
}

// Run the quick fix
quickFix().catch(console.error);
