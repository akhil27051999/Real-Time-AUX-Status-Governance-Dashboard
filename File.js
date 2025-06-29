// ==UserScript==
// @name         Enhanced Agent Activity Monitor (Updated Positions)
// @namespace    httptampermonkey.net
// @version      1.6
// @description  Monitor agent activity duration for various activities
// @author       thakhilk@
// @match        httpsyour-website-url.com
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    let dashboard = null;  // Variable to store the dashboard element
    const lastActivityCounts = {};  // Object to track previous counts for pop-out logic

    // Threshold times in seconds for different activities
    const activityThresholds = {
        Available: 10800,  // 3 hours in seconds
        Break: 600,  // 10 minutes in seconds
        Lunch: 600,  // 10 minutes in seconds
        Meeting: 1800,  // 30 minutes in seconds
        Training: 1800,  // 30 minutes in seconds
    };

    // Background colors for different activity types
    const activityColors = [
        '#fdecea',  // Light red for Available
        '#fff9e6',  // Light yellow for Break
        '#e9fce8',  // Light green for Lunch
        '#fce8f6',  // Light pink for Meeting
        '#e8f6fc',  // Light teal for Training
    ];

    // Function to create the dashboard HTML structure
    function createDashboard() {
        if (dashboard) dashboard.remove();  // Remove existing dashboard to avoid duplicates
        dashboard = document.createElement('div');  // Create a new div for the dashboard
        dashboard.style.position = 'fixed';  // Set fixed position
        dashboard.style.top = '20px';  // Place it near the top
        dashboard.style.right = '10px';  // Place it on the right
        dashboard.style.backgroundColor = '#f9f9f9';  // Background color
        dashboard.style.color = '#333';  // Text color
        dashboard.style.padding = '10px';  // Padding inside the dashboard
        dashboard.style.borderRadius = '8px';  // Rounded corners
        dashboard.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';  // Shadow for depth
        dashboard.style.fontSize = '14px';  // Set font size
        dashboard.style.zIndex = '1000';  // Ensure it stays on top
        dashboard.style.textAlign = 'left';  // Align text to the left
        dashboard.style.maxWidth = '300px';  // Max width of dashboard
        dashboard.style.overflowY = 'auto';  // Allow scrolling if content overflows
        dashboard.style.maxHeight = '70vh';  // Max height of dashboard

        // HTML structure for the dashboard
        dashboard.innerHTML = `
            <h3 style="text-align: center; font-size: 16px; margin-bottom: 10px;">Agent Activity Monitor</h3>
            <div style="margin-bottom: 20px;">
                <h4 style="margin: 0; font-size: 14px; text-align: center;">Total Head Count</h4>
                <div style="padding: 10px; background-color: #eef6fc; border-radius: 6px; text-align: left; color: #333;">
                    <div><strong>EU Region</strong> <span id="EUCount">0</span></div>
                    <div><strong>NA Region</strong> <span id="NACount">0</span></div>
                    <div><strong>Total</strong> <span id="TotalProfiles">0</span></div>
                </div>
            </div>
            ${Object.keys(activityThresholds)
                .map((activity, index) => `
                <div id="${activity}Section" style="display: none; margin-bottom: 10px; padding: 5px; background-color ${activityColors[index % activityColors.length]}; color: #333; border-radius: 6px;">
                    <strong>${activity} (${activityThresholds[activity] / 60} mins)</strong> <span id="${activity}Count">0</span>
                    <button id="btn${activity}ShowAgents">Show Agents</button>
                    <div id="${activity}List" style="display: none; margin-top: 5px;"></div>
                </div>`).join('')}
        `;

        // Append the dashboard to the document body
        document.body.appendChild(dashboard);

        // Add event listeners to toggle agent list visibility when clicking the "Show Agents" button
        Object.keys(activityThresholds).forEach((activity) => {
            document
                .getElementById(`btn${activity}ShowAgents`)
                .addEventListener('click', () => toggleVisibility(`${activity}List`));
        });
    }

    // Function to toggle the visibility of the agent list (shows or hides it)
    function toggleVisibility(elementId) {
        const element = document.getElementById(elementId);
        if (element.style.display === 'none') {
            element.style.display = 'block';
        } else {
            element.style.display = 'none';
        }
    }

    // Function to update the dashboard with the latest activity data
    function updateDashboard(activityData, profileCounts) {
        Object.keys(activityData).forEach((activity) => {
            const { count, agents } = activityData[activity];
            const activityCountElem = document.getElementById(`${activity}Count`);
            const activitySectionElem = document.getElementById(`${activity}Section`);

            // Show the section when the activity count is greater than 0
            if (lastActivityCounts[activity] === 0 && count > 0) {
                activitySectionElem.style.display = 'block';  // Show section
            }

            // Update the activity count and agent list
            activityCountElem.textContent = count;
            document.getElementById(`${activity}List`).innerHTML = agents.map((agent) => `<div>${agent}</div>`).join('');

            // Update the last count for the activity
            lastActivityCounts[activity] = count;
        });

        // Update the routing profile counts (EU and NA)
        document.getElementById('EUCount').textContent = profileCounts['EU_BASE_RSOB'] > 0;
        document.getElementById('NACount').textContent = profileCounts['NA_BASE_RSOB'] > 0;
        document.getElementById('TotalProfiles').textContent =
            profileCounts['EU_BASE_RSOB'] + profileCounts['NA_BASE_RSOB'];
    }

    // Function to parse the duration string (HH:MM:SS) to seconds
    function parseDuration(durationText) {
        const parts = durationText.split(':').map(Number);  // Split and convert to numbers
        return parts[0] * 3600 + parts[1] * 60 + parts[2];  // Convert to seconds
    }

    // Function to monitor agent activities and count agents based on thresholds
    function monitorAgentActivity() {
        try {
            const activityData = {};  // Store activity data (count and agents)
            const profileCounts = { EU_BASE_RSOB: 0, NA_BASE_RSOB: 0 };  // Routing profile counts

            // Initialize activity data structure
            Object.keys(activityThresholds).forEach((activity) => {
                if (!(activity in lastActivityCounts)) {
                    lastActivityCounts[activity] = 0;  // Initialize previous count to 0
                }
                activityData[activity] = { count: 0, agents: [] };  // Initialize activity data
            });

            // Select all rows of the activity table
            const rows = document.querySelectorAll('table tbody tr');
            rows.forEach((row) => {
                const agentLogin = row.querySelector('td[data-testid=metric-cell-agent_view_login]').textContent.trim();
                const duration = row.querySelector('td[data-testid=metric-cell-agent_view_state_duration]').textContent.trim();
                const activity = row.querySelector('span.styles_agent-view-state-cell__content__rF9vj').textContent.trim();
                const routingProfile = row.querySelector('td[data-testid=metric-cell-agent_view_profile]').textContent.trim();

                // Increment the count for the respective routing profile
                if (routingProfile === 'EU_BASE_RSOB') {
                    profileCounts['EU_BASE_RSOB']++;
                } else if (routingProfile === 'NA_BASE_RSOB') {
                    profileCounts['NA_BASE_RSOB']++;
                }

                // If the activity is valid and exceeds the threshold, add the agent
                if (activity && activityThresholds[activity]) {
                    const durationInSeconds = parseDuration(duration);
                    if (durationInSeconds >= activityThresholds[activity]) {
                        activityData[activity].count++;
                        activityData[activity].agents.push(agentLogin);  // Add agent to the list
                    }
                }
            });

            // Update the dashboard with the monitored data
            updateDashboard(activityData, profileCounts);
        } catch (err) {
            console.error('Error monitoring agent activity', err);
        }
    }

    // Function to initialize monitoring after the table is available on the page
    function waitForTableAndInitialize() {
        const tableObserver = new MutationObserver(() => {
            const table = document.querySelector('table tbody');
            if (table) {
                tableObserver.disconnect();  // Disconnect the observer once the table is found
                createDashboard();  // Create the dashboard
                monitorAgentActivity();  // Start monitoring agent activity

                // Set up an observer to monitor changes in the table (new agents, updates)
                const observer = new MutationObserver(() => {
                    monitorAgentActivity();  // Refresh agent activity
                });

                observer.observe(table, {
                    childList: true,  // Observe direct child elements
                    subtree: true,  // Observe all descendants
                });

                // Set an interval to refresh the activity data every 60 seconds
                setInterval(() => {
                    monitorAgentActivity();  // Refresh the data
                }, 60000);  // 60000 milliseconds = 1 minute
            }
        });

        tableObserver.observe(document.body, {
            childList: true,  // Observe direct child elements of the body
            subtree: true,  // Observe all descendants
        });
    }

    // Wait for the page to load and initialize monitoring
    window.addEventListener('load', () => {
        waitForTableAndInitialize();  // Initialize monitoring when page is ready
    });

    // Add styles for the dashboard and buttons
    GM_addStyle(`
        body {
            font-family: Arial, sans-serif;
        }
        button {
            margin-top: 5px;
            padding: 5px;
            font-size: 12px;
            background-color: #666;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background-color: #444;  // Darker background on hover
        }
    `);
})();
