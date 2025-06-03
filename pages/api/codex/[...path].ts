import { NextApiRequest, NextApiResponse } from "next";
import getRawBody from "raw-body";

const CODEX_API_BASE = "https://api.demo.codex.storage/fileshareapp/api/codex";
const CODEX_USERNAME = "codex";
const CODEX_PASSWORD = "iOpcciMDt2xCJnPrlJ86AaBOrbTzFH";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Get the path from the URL
    const { path } = req.query;
    const apiPath = Array.isArray(path) ? path.join("/") : path;

    // Construct the target URL
    const targetUrl = `${CODEX_API_BASE}/${apiPath}`;
    console.log("Proxying request to:", targetUrl);

    // Create Basic Auth header
    const base64Credentials = Buffer.from(
      `${CODEX_USERNAME}:${CODEX_PASSWORD}`
    ).toString("base64");

    // Prepare headers
    const headers = new Headers({
      Authorization: `Basic ${base64Credentials}`,
      Host: new URL(CODEX_API_BASE).host,
    });

    // Copy relevant headers from the original request
    ["accept", "content-type", "content-length", "content-disposition"].forEach(
      (header) => {
        const value = req.headers[header];
        if (value) {
          headers.set(header, value.toString());
        }
      }
    );

    // Get the raw body if needed
    let body: Buffer | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = await getRawBody(req);
    }

    // Forward the request to the Codex API
    const response = await fetch(targetUrl, {
      method: req.method || "GET",
      headers,
      body,
    });

    // Copy the response headers
    response.headers.forEach((value, key) => {
      if (value) {
        res.setHeader(key, value);
      }
    });

    // Set the status
    res.status(response.status);

    // Send the response
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Error in Codex API proxy:", error);
    res.status(500).json({
      error: "Internal Server Error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
