const { Readable } = require("node:stream");

const EPG_URL = process.env.EPG_URL;

module.exports = async (req, res) => {
  if (!EPG_URL) {
    console.error("EPG_URL environment variable is not set.");
    return res
      .status(500)
      .send("Server configuration error: EPG source URL is missing.");
  }

  try {
    const response = await fetch(EPG_URL);

    if (!response.ok) {
      console.error(
        `Upstream EPG source returned an error: ${response.status} ${response.statusText}`
      );
      return res.status(502).send("Failed to fetch EPG data from the source.");
    }

    const arrayBuffer = await response.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Encoding", "gzip");
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Length", buffer.length);

    if (response.headers.get("Cache-Control")) {
      res.setHeader("Cache-Control", response.headers.get("Cache-Control"));
    }
    if (response.headers.get("etag")) {
      res.setHeader("ETag", response.headers.get("etag"));
    }

    return res.send(buffer);
  } catch (error) {
    console.error("Error proxying EPG stream:", error);
    return res
      .status(500)
      .send("Internal server error while proxying EPG file.");
  }
};
