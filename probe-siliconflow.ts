
const apiKey = process.env.SILICONFLOW_API_KEY;
const baseURL = process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1";

if (!apiKey) {
  console.error("Please set SILICONFLOW_API_KEY");
  process.exit(1);
}

async function main() {
  console.log("Testing non-streaming...");
  try {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-V3",
        messages: [{ role: "user", content: "Hello" }],
        stream: false
      })
    });
    const json = await res.json();
    console.log("Non-streaming response:", JSON.stringify(json, null, 2));
  } catch (e) {
    console.error("Non-streaming error:", e);
  }

  console.log("\nTesting streaming...");
  try {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-V3",
        messages: [{ role: "user", content: "Hello" }],
        stream: true
      })
    });

    if (!res.body) throw new Error("No body");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      console.log("Chunk:", text);
    }
  } catch (e) {
    console.error("Streaming error:", e);
  }
}

main();
