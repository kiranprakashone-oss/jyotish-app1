/**
 * Cloudflare Worker API Gateway for Vedic Jyotish Analysis Engine
 * File Path: worker/src/index.js
 */

export default {
  async fetch(request, env) {
    // Standard CORS headers for mobile browser access
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // 1. Handle HTTP OPTIONS preflight check from browser
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // 2. Restrict to POST requests only
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Only POST method is allowed." }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    try {
      const body = await request.json();
      const prompt = body.prompt;

      // Prioritize client-provided override key, otherwise fallback to Cloudflare Secret
      const apiKey = body.apiKey || env.GEMINI_API_KEY;

      if (!apiKey) {
        return new Response(
          JSON.stringify({
            error: "API Key missing. Configure GEMINI_API_KEY secret on Cloudflare or provide key in app.",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!prompt) {
        return new Response(
          JSON.stringify({ error: "Prompt input is required." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Target active stable Gemini Flash model endpoint
      const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const googlePayload = {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      };

      // Server-side fetch to Google (completely bypasses mobile browser CORS)
      const googleResponse = await fetch(googleApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(googlePayload),
      });

      const responseData = await googleResponse.json();

      // Return error if Google API rejected the request
      if (!googleResponse.ok) {
        const errorMessage = responseData.error?.message || "Google API request failed";
        return new Response(
          JSON.stringify({ error: errorMessage }),
          {
            status: googleResponse.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Return success response to the mobile client
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (error) {
      console.error("Worker Execution Error:", error);
      return new Response(
        JSON.stringify({ error: error.message || "Internal Server Error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  },
};
