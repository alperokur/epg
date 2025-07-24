# Advanced Xtream API & EPG Proxy

[![EPG Update Status](https://github.com/alperokur/xtream-api-proxy-epg/actions/workflows/epg-deployment.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPOSITORY/actions/workflows/epg-deployment.yml)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_USERNAME%2FYOUR_REPOSITORY)

This project provides a comprehensive, Vercel-deployable proxy for an Xtream Codes based IPTV provider. It goes beyond simple redirection by offering powerful features like custom EPG generation, dynamic stream metadata overrides, and user credential mapping, all powered by Vercel Serverless Functions and Upstash Redis.

## ✨ Key Features

- **⚙️ Xtream API Proxy:** Hides your original provider's URL, providing a clean, custom domain for your IPTV client.
- **📝 Custom EPG Generation:** Automatically generates a custom `guide.xml` file using the powerful [iptv-org/epg](https://github.com/iptv-org/epg) grabber and a simple `channels.xml` configuration.
- **🔄 Stream Metadata Overrides:** Dynamically change stream names, logos, EPG IDs, and more on-the-fly using data stored in an Upstash Redis database.
- **👤 User Credential Mapping:** Create custom, "vanity" usernames and passwords for your users that map to the real credentials on the backend provider. This adds a layer of abstraction and security.
- **🚀 Deployed on the Edge:** Built to be deployed on Vercel for fast, global performance.
- **🕒 Automated EPG Updates:** A GitHub Actions workflow keeps your EPG data fresh by running automatically on a schedule.
- **🌐 Clean EPG & Stream URLs:** Provides user-friendly endpoints like `/xmltv.php` for EPG and handles stream redirects seamlessly.

## 🏛️ Architecture Overview

This project is split into two main components that work together:

1.  **EPG Generation (GitHub Actions & Pages):**

    - A GitHub Action runs on a schedule (or manually).
    - It uses the channel list in `data/channels.xml` and the `iptv-org/epg` tool to grab program data from various sources.
    - The resulting `guide.xml` is compressed (`guide.xml.gz`) and deployed to a public GitHub Pages site.
    - This provides a stable, versioned, and free hosting solution for the EPG file.

2.  **API & Stream Proxy (Vercel & Redis):**
    - An IPTV client connects to your Vercel deployment's `player_api.php` endpoint.
    - The `api/player_api.js` function intercepts the request.
    - It connects to Upstash Redis to:
      - Check if the provided username/password should be swapped for real credentials (`user_credentials` hash).
      - Load custom stream metadata overrides (`stream_overrides` JSON).
    - It forwards the (potentially modified) request to the original Xtream provider.
    - When receiving the stream list, it applies the custom overrides before sending the response back to the client.
    - It modifies the `server_info` in the response to point back to the Vercel proxy URL, ensuring all subsequent requests (including stream playback) go through the proxy.
    - When a client requests a stream, `api/redirect.js` handles it, issuing a 302 redirect to the original stream URL.
    - The `/xmltv.php` endpoint is handled by `api/xmltv.js`, which acts as a simple proxy to the `guide.xml.gz` file hosted on GitHub Pages.

## 🚀 Deployment & Setup

Follow these steps to get your own proxy up and running.

### Prerequisites

- A **GitHub** account.
- A **Vercel** account.
- An **Upstash** account for the free Redis database.
- An existing **Xtream Codes** IPTV provider subscription (URL, Username, Password).

### Step 1: Fork the Repository

Fork this repository to your own GitHub account.

### Step 2: Configure Upstash Redis

1.  Go to [Upstash](https://console.upstash.com/) and create a new **Global** Redis database. The free tier is sufficient.
2.  Once created, navigate to the database details page and copy the following environment variables:
    - `UPSTASH_REDIS_REST_URL`
    - `UPSTASH_REDIS_REST_TOKEN`
3.  (Optional) If you want to use the **Credential Mapping** or **Stream Override** features, you need to populate your Redis database. You can do this using the Upstash Console's "CLI" or any Redis client.

    - **For Stream Overrides:**
      Create a JSON key named `stream_overrides` with an object containing your overrides, where each key is a unique identifier.

      ```sh
      # Example using redis-cli
      JSON.SET stream_overrides $ '{"101": {"name": "My Custom News", "stream_icon": "https://some.icon/news.png"}, "205": {"epg_channel_id": "Movies.us.custom"}}'
      ```

    - **For Credential Mapping:**
      Create a Hash named `user_credentials`.
      ```sh
      # Example using redis-cli
      HSET user_credentials my_custom_user '{"real_username": "realuser", "real_password": "realpassword", "custom_password": "my_secret_pass"}'
      ```

### Step 3: Configure GitHub for EPG Hosting

1.  In your forked repository on GitHub, go to `Settings` > `Pages`.
2.  Under `Build and deployment`, set the `Source` to **GitHub Actions**.
3.  Customize your channel list by editing the `data/channels.xml` file.
4.  Go to the `Actions` tab of your repository, find the "EPG Updater and Deployer" workflow, and run it manually.
5.  After the action completes successfully, go back to your GitHub Pages settings. You should see the URL where your site is published (e.g., `https://your-username.github.io/your-repository/`).
6.  Your EPG file will be available at `https://your-username.github.io/your-repository/guide.xml.gz`. **Copy this URL.**

### Step 4: Deploy to Vercel

1.  Click the "Deploy with Vercel" button at the top of this README or import your forked repository manually in the Vercel dashboard.
2.  During the import process, Vercel will ask for Environment Variables. Add the following:

    | Variable Name              | Value                      | Description                                         |
    | :------------------------- | :------------------------- | :-------------------------------------------------- |
    | `ORIGINAL_XTREAM_URL`      | `http://provider.url:port` | The full URL of your real IPTV provider.            |
    | `EPG_URL`                  | `https://.../guide.xml.gz` | The GitHub Pages URL for your EPG file from Step 3. |
    | `UPSTASH_REDIS_REST_URL`   | `https://...`              | From your Upstash database.                         |
    | `UPSTASH_REDIS_REST_TOKEN` | `A...`                     | From your Upstash database.                         |

3.  Deploy the project. Vercel will provide you with your new proxy URL (e.g., `https://my-proxy-app.vercel.app`).

### Step 5: Configure Your IPTV Client

You're all set! Use the following details in your IPTV player (like TiviMate, IPTV Smarters, etc.):

- **Server / Portal URL:** `https://my-proxy-app.vercel.app`
- **Username:** Your custom username (if configured in Redis) or your real username.
- **Password:** Your custom password (if configured in Redis) or your real password.
- **EPG URL:** `https://my-proxy-app.vercel.app/xmltv.php`

## 🛠️ Managing Stream Overrides

You can dynamically update the stream metadata overrides without re-deploying your application by sending a `POST` request to the `player_api.php` endpoint.

The body of the request must be a JSON object where each key is a unique identifier (can be the stream ID or any other unique string) and the value is an object containing the properties you want to override.

The `stream_id` in the inner object is crucial as it's used to map the override to the correct stream from the provider.

**Example using `curl`:**

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
        "101": {
            "name": "News Channel HD (Custom)",
            "stream_icon": "https://example.com/logos/news_channel.png",
            "epg_channel_id": "NewsChannel.us",
            "stream_id": 101
        },
        "205": {
            "name": "Movies Premiere (Custom)",
            "stream_icon": "https://example.com/logos/movies_premiere.png",
            "epg_channel_id": "Movies.uk",
            "stream_id": 205
        }
     }' \
  https://my-proxy-app.vercel.app/player_api.php
```

A successful request will save this JSON object to your Redis database under the key `stream_overrides`, and the changes will be applied the next time your IPTV client refreshes its channel list.

## 📂 File Structure

- `/api`: Contains the Vercel Serverless Functions.
  - `player_api.js`: The core Xtream API proxy logic, handling authentication, stream list modifications, and override management.
  - `redirect.js`: Handles 302 redirects for actual video streams, pointing the client to the original source.
  - `xmltv.js`: Proxies the EPG file from GitHub Pages, providing a stable endpoint.
- `/data`:
  - `channels.xml`: The configuration file for the EPG grabber. **This is the main file you'll edit** to define which channels' EPG data to fetch.
- `/.github/workflows`:
  - `epg-deployment.yml`: The GitHub Action that generates and deploys the EPG to GitHub Pages on a schedule.
- `/templates`:
  - `index.html.template`: A simple HTML template for the GitHub Pages status page, showing file size and last update time.
- `vercel.json`: Vercel project configuration, including the crucial URL rewrites that map clean URLs like `/player_api.php` to the serverless functions.

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.
