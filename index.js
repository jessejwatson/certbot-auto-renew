#!/usr/bin/env node

const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");

// Function to execute shell commands and return a promise
function executeCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stderr });
            } else {
                resolve(stdout);
            }
        });
    });
}

// Function to log messages
function logMessage(message, isError = false) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${isError ? "ERROR: " : ""}${message}\n`;
    fs.appendFileSync("cert-renewal.log", logEntry);
    console.log(logEntry.trim());
}

// Main async function
async function main() {
    try {
        // Read config file
        const configPath = path.join(__dirname, "config.json");
        const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

	// Check if domains are configured
	if (!config.domains || !Array.isArray(config.domains)) {
	    throw new Error("No domains in configuration file");
	}

        // Stop reverse proxy
        logMessage("Stopping reverse proxy...");
        await executeCommand("docker stop reverse-proxy");
        logMessage("Reverse proxy stopped successfully");

        // Process each domain
	
        for (const entry of config.domains) {
            const { url, docker_volume } = entry;
            const volumeName = docker_volume || "reverse-proxy-certs";

            try {
                // Run certbot
                logMessage(`Obtaining certificate for ${url}`);
                await executeCommand(
                    `certbot certonly -d ${url} --standalone -v --non-interactive --keep-until-expiring`,
                );

                // Create directory if it doesn't exist
                const certDir = `/var/lib/docker/volumes/${volumeName}/_data/${url}`;
                await executeCommand(`mkdir -p ${certDir}`);

                // Copy certificates
                logMessage(`Copying certificates for ${url}`);
                await executeCommand(
                    `cat /etc/letsencrypt/live/${url}/fullchain.pem | tee /var/lib/docker/volumes/${volumeName}/_data/${url}/fullchain.pem > /dev/null`,
                );
                await executeCommand(
                    `cat /etc/letsencrypt/live/${url}/privkey.pem | tee /var/lib/docker/volumes/${volumeName}/_data/${url}/privkey.pem > /dev/null`,
                );

                logMessage(`Successfully processed ${url}`);
            } catch (err) {
                logMessage(
                    `Failed to process ${url}: ${err.error || err.stderr}`,
                    true,
                );
            }
        }
    } catch (err) {
        logMessage(`Script execution failed: ${err.message || JSON.stringify(err)}`, true);
        process.exit(1);
    } finally {
        // Attempt to start reverse proxy no matter what
        try {
            logMessage("Starting reverse proxy...");
            await executeCommand("docker start reverse-proxy");
            logMessage("Reverse proxy started successfully");
        } catch (e) {
            logMessage(
                `Failed to start reverse proxy: ${e.error || e.stderr}`,
                true,
            );
        }
    }
}

// Execute main function
main().catch((err) => {
    logMessage(`Unexpected error: ${err.message || err}`, true);
    process.exit(1);
});
