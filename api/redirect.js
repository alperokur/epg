const { Redis } = require("@upstash/redis");

const { ORIGINAL_XTREAM_URL } = process.env;
const redis = Redis.fromEnv();

module.exports = async (req, res) => {
  if (!ORIGINAL_XTREAM_URL) {
    return res
      .status(500)
      .send("Stream proxy redirector is not configured.");
  }

  const { type, username, password, streamId } = req.query;

  if (!username || !password || !streamId) {
    const originalPath = req.url;
    const redirectUrl = `${ORIGINAL_XTREAM_URL}${originalPath}`;
    res.writeHead(302, { Location: redirectUrl });
    res.end();
    return;
  }

  let finalUsername = username;
  let finalPassword = password;

  try {
    const userData = await redis.hget("user_credentials", username);

    if (userData && userData.custom_password === password) {
      console.log(
        `Swapping credentials for redirect: ${username} -> ${userData.real_username}`
      );
      finalUsername = userData.real_username;
      finalPassword = userData.real_password;
    } else if (userData) {
      console.warn(
        `Incorrect password for user '${username}' during redirect.`
      );
    }
  } catch (error) {
    console.error(`Redis error during redirect:`, error);
  }

  const newPath = `/${
    type ? `${type}/` : ""
  }${finalUsername}/${finalPassword}/${streamId}`;

  const redirectUrl = `${ORIGINAL_XTREAM_URL}${newPath}`;

  res.writeHead(302, {
    Location: redirectUrl,
  });
  res.end();
};