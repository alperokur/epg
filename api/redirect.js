module.exports = (req, res) => {
  const { ORIGINAL_XTREAM_URL } = process.env;

  if (!ORIGINAL_XTREAM_URL) {
    return res.status(500).send("Stream proxy redirector is not configured.");
  }

  const originalPath = req.url;
  const redirectUrl = `${ORIGINAL_XTREAM_URL}${originalPath}`;

  res.writeHead(302, {
    Location: redirectUrl,
  });
  res.end();
};
