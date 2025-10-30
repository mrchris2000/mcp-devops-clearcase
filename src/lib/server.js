#!/usr/bin/env node


import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config as loadEnv } from 'dotenv';
import { spawn } from "child_process";

// Load environment variables from .env file if it exists
// loadEnv();

// Create an MCP server
const server = new McpServer({
    name: "MCP DevOps ClearCase",
    version: "1.0.0"
});

// Cleanup handler
async function cleanup() {
    process.exit(0);
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);


// Helper function to execute ClearTool commands
async function executeClearToolCommand(command, args) {
    return new Promise((resolve, reject) => {
        console.log(`Executing command: ${command} ${args.join(" ")}`);
        const process = spawn(command, args);
        let output = "";
        let error = "";

        process.stdout.on("data", (data) => {
            output += data.toString();
        });

        process.stderr.on("data", (data) => {
            error += data.toString();
        });

        process.on("close", (code) => {
            if (code === 0) {
                resolve(output.trim());
            } else {
                reject(new Error(error.trim() || `Process exited with code ${code}`));
            }
        });
    });
}

// Tool to retrieve ClearCase views
server.tool(
    "get_clearcase_views",
    "Retrieve a list of available ClearCase views",
    {},
    async () => {
        try {
            const output = await executeClearToolCommand("cleartool", ["lsview"]);
            return { content: [{ type: 'text', text: `Views:\n${output}` }] };
        } catch (error) {
            return { content: [{ type: 'text', text: `Error retrieving views: ${error.message}` }] };
        }
    }
);

// Tool to get resource status
server.tool(
    "get_resource_status",
    "Retrieve the status of a specific resource",
    {
        resourcePath: z.string().describe("Path to the resource")
    },
    async ({ resourcePath }) => {
        try {
            const output = await executeClearToolCommand("cleartool", ["describe", resourcePath]);
            return { content: [{ type: 'text', text: `Resource status:\n${output}` }] };
        } catch (error) {
            return { content: [{ type: 'text', text: `Error retrieving resource status: ${error.message}` }] };
        }
    }
);

// Tool to create or set UCM activity
server.tool(
    "create_or_set_ucm_activity",
    "Create a new UCM activity or set an existing one",
    {
        activityId: z.string().optional().describe("ID of the activity to set (optional)"),
        activityHeadline: z.string().optional().describe("Headline for the new activity (optional)"),
        setActivity: z.boolean().describe("Whether to set the activity after creation")
    },
    async ({ activityId, activityHeadline, setActivity }) => {
        try {
            if (activityId) {
                await executeClearToolCommand("cleartool", ["setactivity", activityId]);
                return { content: [{ type: 'text', text: `Activity ${activityId} set successfully.` }] };
            } else if (activityHeadline) {
                const output = await executeClearToolCommand("cleartool", ["mkactivity", "-headline", activityHeadline]);
                if (setActivity) {
                    const activityId = output.split("\n")[0]; // Extract activity ID from output
                    await executeClearToolCommand("cleartool", ["setactivity", activityId]);
                }
                return { content: [{ type: 'text', text: `Activity created successfully:\n${output}` }] };
            } else {
                throw new Error("Either activityId or activityHeadline must be provided.");
            }
        } catch (error) {
            return { content: [{ type: 'text', text: `Error creating or setting activity: ${error.message}` }] };
        }
    }
);

// Tool to checkout resources
server.tool(
    "checkout_resources",
    "Checkout one or more resources for editing",
    {
        resourcePaths: z.array(z.string()).describe("List of resource paths to checkout"),
        comment: z.string().optional().describe("Comment for the checkout operation")
    },
    async ({ resourcePaths, comment }) => {
        try {
            const commentArg = comment ? comment.replace(/"/g, '\\"') : "automated checkout";
            const results = await Promise.all(
                resourcePaths.map((path) =>
                    executeClearToolCommand("cleartool", ["checkout", "-c", commentArg, path])
                )
            );
            return { content: [{ type: 'text', text: `Checkout results:\n${results.join("\n")}` }] };
        } catch (error) {
            return { content: [{ type: 'text', text: `Error checking out resources: ${error.message}` }] };
        }
    }
);

// Tool to undo checkout
server.tool(
    "undo_checkout",
    "Undo the checkout of one or more resources",
    {
        resourcePaths: z.array(z.string()).describe("List of resource paths to undo checkout"),
        keepChanges: z.boolean().optional().describe("Whether to keep local changes")
    },
    async ({ resourcePaths, keepChanges }) => {
        try {
            const results = await Promise.all(
                resourcePaths.map((path) =>
                    executeClearToolCommand("cleartool", ["uncheckout", keepChanges ? "-keep" : "-rm", path])
                )
            );
            return { content: [{ type: 'text', text: `Undo checkout results:\n${results.join("\n")}` }] };
        } catch (error) {
            return { content: [{ type: 'text', text: `Error undoing checkout: ${error.message}` }] };
        }
    }
);

// Tool to checkin resources
server.tool(
    "checkin_resources",
    "Check in one or more resources to ClearCase",
    {
        resourcePaths: z.array(z.string()).describe("List of resource paths to check in"),
        comment: z.string().optional().describe("Comment for the check-in operation"),
        checkinIdentical: z.boolean().optional().describe("Whether to allow check-in of identical files")
    },
    async ({ resourcePaths, comment, checkinIdentical }) => {
        try {
            const commentArg = comment ? comment.replace(/"/g, '\\"') : "automated checkin";
            const args = ["checkin"];
            if (checkinIdentical) {
                args.push("-identical");
            }
            args.push("-c", commentArg);
            
            const results = await Promise.all(
                resourcePaths.map((path) =>
                    executeClearToolCommand("cleartool", [...args, path])
                )
            );
            return { content: [{ type: 'text', text: `Check-in results:\n${results.join("\n")}` }] };
        } catch (error) {
            return { content: [{ type: 'text', text: `Error checking in resources: ${error.message}` }] };
        }
    }
);

// Tool to login to ClearCase
server.tool(
    "login",
    "Authenticate with ClearCase",
    {
        wanServer: z.string().describe("WAN server URL"),
        username: z.string().describe("Username"),
        password: z.string().describe("Password")
    },
    async ({ wanServer, username, password }) => {
        try {
            const output = await executeClearToolCommand("cleartool", ["login", "-server", wanServer, "-user", username, "-password", password]);
            return { content: [{ type: 'text', text: `Login successful:\n${output}` }] };
        } catch (error) {
            return { content: [{ type: 'text', text: `Error during login: ${error.message}` }] };
        }
    }
);

// Tool to logout from ClearCase
server.tool(
    "logout",
    "Logout from ClearCase",
    {},
    async () => {
        try {
            const output = await executeClearToolCommand("cleartool", ["logout"]);
            return { content: [{ type: 'text', text: `Logout successful:\n${output}` }] };
        } catch (error) {
            return { content: [{ type: 'text', text: `Error during logout: ${error.message}` }] };
        }
    }
);

// Tool to add a view
server.tool(
    "add_view",
    "Add a ClearCase view",
    {
        viewPath: z.string().describe("Path to the view")
    },
    async ({ viewPath }) => {
        try {
            const output = await executeClearToolCommand("cleartool", ["mkview", viewPath]);
            return { content: [{ type: 'text', text: `View added successfully:\n${output}` }] };
        } catch (error) {
            return { content: [{ type: 'text', text: `Error adding view: ${error.message}` }] };
        }
    }
);

// Tool to update a view
server.tool(
    "update_view",
    "Update a ClearCase view",
    {
        viewPath: z.string().describe("Path to the view")
    },
    async ({ viewPath }) => {
        try {
            const output = await executeClearToolCommand("cleartool", ["setcs", "-current", viewPath]);
            return { content: [{ type: 'text', text: `View updated successfully:\n${output}` }] };
        } catch (error) {
            return { content: [{ type: 'text', text: `Error updating view: ${error.message}` }] };
        }
    }
);

// Tool to add resources to source control
server.tool(
    "add_resources",
    "Add resources to ClearCase source control",
    {
        resourcePaths: z.array(z.string()).describe("List of resource paths to add"),
        comment: z.string().optional().describe("Comment for the add operation")
    },
    async ({ resourcePaths, comment }) => {
        try {
            const commentArg = comment ? comment.replace(/"/g, '\\"') : "automated add";
            const results = await Promise.all(
                resourcePaths.map((path) =>
                    executeClearToolCommand("cleartool", ["mkelem", "-c", commentArg, path])
                )
            );
            return { content: [{ type: 'text', text: `Add results:\n${results.join("\n")}` }] };
        } catch (error) {
            return { content: [{ type: 'text', text: `Error adding resources: ${error.message}` }] };
        }
    }
);

// Tool to hijack resources
server.tool(
    "hijack_resources",
    "Hijack one or more resources",
    {
        resourcePaths: z.array(z.string()).describe("List of resource paths to hijack")
    },
    async ({ resourcePaths }) => {
        try {
            const results = await Promise.all(
                resourcePaths.map((path) =>
                    executeClearToolCommand("cleartool", ["hijack", path])
                )
            );
            return { content: [{ type: 'text', text: `Hijack results:\n${results.join("\n")}` }] };
        } catch (error) {
            return { content: [{ type: 'text', text: `Error hijacking resources: ${error.message}` }] };
        }
    }
);

// Tool to undo hijack
server.tool(
    "undo_hijack",
    "Undo the hijack of one or more resources",
    {
        resourcePaths: z.array(z.string()).describe("List of resource paths to undo hijack")
    },
    async ({ resourcePaths }) => {
        try {
            const results = await Promise.all(
                resourcePaths.map((path) =>
                    executeClearToolCommand("cleartool", ["unhijack", path])
                )
            );
            return { content: [{ type: 'text', text: `Undo hijack results:\n${results.join("\n")}` }] };
        } catch (error) {
            return { content: [{ type: 'text', text: `Error undoing hijack: ${error.message}` }] };
        }
    }
);

// Tool to rename a resource
server.tool(
    "rename_resource",
    "Rename a ClearCase resource",
    {
        resourcePath: z.string().describe("Path to the resource to rename"),
        newName: z.string().describe("New name for the resource")
    },
    async ({ resourcePath, newName }) => {
        try {
            const output = await executeClearToolCommand("cleartool", ["mv", resourcePath, newName]);
            return { content: [{ type: 'text', text: `Resource renamed successfully:\n${output}` }] };
        } catch (error) {
            return { content: [{ type: 'text', text: `Error renaming resource: ${error.message}` }] };
        }
    }
);

// Tool to remove a resource
server.tool(
    "remove_resource",
    "Remove a ClearCase resource",
    {
        resourcePath: z.string().describe("Path to the resource to remove")
    },
    async ({ resourcePath }) => {
        try {
            const output = await executeClearToolCommand("cleartool", ["rmname", resourcePath]);
            return { content: [{ type: 'text', text: `Resource removed successfully:\n${output}` }] };
        } catch (error) {
            return { content: [{ type: 'text', text: `Error removing resource: ${error.message}` }] };
        }
    }
);

// Tool to open a file
server.tool(
    "open_file",
    "Open a ClearCase file",
    {
        filePath: z.string().describe("Path to the file to open")
    },
    async ({ filePath }) => {
        try {
            const output = await executeClearToolCommand("cleartool", ["describe", filePath]);
            return { content: [{ type: 'text', text: `File opened successfully:\n${output}` }] };
        } catch (error) {
            return { content: [{ type: 'text', text: `Error opening file: ${error.message}` }] };
        }
    }
);


// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
