const { Redis } = require("@upstash/redis");

const { ORIGINAL_XTREAM_URL } = process.env;
const redis = Redis.fromEnv();

const loadCustomDataFromRedis = async () => {
  const customDataMap = new Map();
  try {
    const customData = await redis.json.get("stream_overrides");
    if (
      customData &&
      typeof customData === "object" &&
      !Array.isArray(customData)
    ) {
      for (const item of Object.values(customData)) {
        if (item && item.stream_id) {
          customDataMap.set(item.stream_id, item);
        }
      }
    } else if (Array.isArray(customData)) {
      for (const item of customData) {
        if (item && item.stream_id) {
          customDataMap.set(item.stream_id, item);
        }
      }
    }
  } catch (error) {
    if (!error.message.includes("not found")) {
      console.warn(
        `Warning: Could not read or process custom data from Redis. ${error.message}`
      );
    }
  }
  return customDataMap;
};

const patchCredentialsIfNeeded = async (searchParams) => {
  const customUsername = searchParams.get("username");
  const customPassword = searchParams.get("password");

  if (!customUsername || !customPassword) {
    return;
  }

  try {
    const userData = await redis.hget("user_credentials", customUsername);

    if (userData) {
      if (userData.custom_password === customPassword) {
        console.log(
          `Swapping credentials: ${customUsername} -> ${userData.real_username}`
        );
        searchParams.set("username", userData.real_username);
        searchParams.set("password", userData.real_password);
      } else {
        console.warn(`Incorrect password for user '${customUsername}'.`);
      }
    }
  } catch (error) {
    console.error(`Redis error while patching credentials:`, error);
  }
};

module.exports = async (req, res) => {
  const fetch = (await import("node-fetch")).default;

  if (req.method === "POST") {
    try {
      const dataToSave = req.body;
      if (
        typeof dataToSave !== "object" ||
        dataToSave === null ||
        Object.keys(dataToSave).length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "The submitted data must be a non-empty JSON object.",
        });
      }
      await redis.json.set("stream_overrides", "$", dataToSave);
      return res.status(200).json({
        success: true,
        message: "Custom data successfully saved to Redis.",
      });
    } catch (error) {
      console.error("Error writing to Redis:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while saving the data.",
      });
    }
  }

  if (req.method === "GET") {
    if (!ORIGINAL_XTREAM_URL) {
      return res.status(500).json({ message: "Proxy configuration error." });
    }

    try {
      const requestUrl = new URL(req.url, `https://${req.headers.host}`);
      const { action } = req.query;

      await patchCredentialsIfNeeded(requestUrl.searchParams);

      const originalApiUrl = `${ORIGINAL_XTREAM_URL}/player_api.php?${requestUrl.searchParams.toString()}`;

      if (!action) {
        const originalResponse = await fetch(originalApiUrl);
        if (!originalResponse.ok) {
          return res
            .status(originalResponse.status)
            .json(await originalResponse.json());
        }
        let data = await originalResponse.json();
        if (data && data.server_info) {
          data.server_info.url = req.headers.host;
          data.server_info.port = "443";
          data.server_info.server_protocol = "https";
        }
        return res.status(200).json(data);
      }

      if (action === "get_live_streams") {
        const [originalResponse, customDataMap] = await Promise.all([
          fetch(originalApiUrl),
          loadCustomDataFromRedis(),
        ]);
        if (!originalResponse.ok) {
          throw new Error(
            `Original provider failed: ${originalResponse.status}`
          );
        }
        let streams = await originalResponse.json();
        if (!Array.isArray(streams)) {
          return res.status(originalResponse.status).json(streams);
        }
        if (customDataMap.size > 0) {
          streams = streams.map((stream) => {
            const customInfo = customDataMap.get(stream.stream_id);
            return customInfo ? { ...stream, ...customInfo } : stream;
          });
        }
        return res.status(200).json(streams);
      }

      const originalResponse = await fetch(originalApiUrl);
      res.status(originalResponse.status);
      originalResponse.headers.forEach((value, key) => {
        if (
          !["content-encoding", "transfer-encoding", "content-length"].includes(
            key.toLowerCase()
          )
        ) {
          res.setHeader(key, value);
        }
      });
      originalResponse.body.pipe(res);
      return;
    } catch (error) {
      console.error("Proxy Error:", error.message);
      return res
        .status(502)
        .json({ message: "Error connecting to the original provider." });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
};