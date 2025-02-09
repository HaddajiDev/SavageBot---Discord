const { verifyKey } = require('discord-interactions');
const axios = require('axios');

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const OPENROUTER_API_KEY = process.env.API;
const OPENROUTER_URL = process.env.URL;
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT;

const chatHistory = {};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}


module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const rawBody = await getRawBody(req);

  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];
  if (!verifyKey(rawBody, signature, timestamp, DISCORD_PUBLIC_KEY)) {
    return res.status(401).send("Bad request signature");
  }

  const body = JSON.parse(rawBody.toString());

  if (req.body.type === 1) {
    return res.status(200).json({ type: 1 });
  }

  if (req.body.type === 2) {
    const commandName = body.data.name;
    const channelId = body.channel_id;
    const user = body.member.user;
    const userMention = `<@${user.id}>`;

    const options = req.body.data.options || [];
    let userMessage = "";
    for (const opt of options) {
      if (opt.name === "message") {
        userMessage = opt.value;
      }
    }
    if (!userMessage) {
      return res.status(200).json({
        type: 4,
        data: { content: "No message provided." }
      });
    }

    if (!chatHistory[channelId]) {
      chatHistory[channelId] = [{ role: "system", content: SYSTEM_PROMPT }];
    }
    chatHistory[channelId].push({ role: "user", content: userMessage });
    chatHistory[channelId] = chatHistory[channelId].slice(-10);

    let responseText = "";
    try {
      const apiResponse = await axios.post(
        OPENROUTER_URL,
        {
          model: "google/gemini-2.0-flash-lite-preview-02-05:free",
          messages: chatHistory[channelId],
          extra_body: {}
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      responseText = apiResponse.data.choices[0].message.content;
      chatHistory[channelId].push({ role: "assistant", content: responseText });      
    } catch (error) {
      responseText = `An error occurred: ${error.message}`;
    }

    const mentionText = `${userMention} `;
    const allowedFirstChunkSize = 2000 - mentionText.length;
    let chunks = [];
    if (responseText.length <= allowedFirstChunkSize) {
      chunks.push(responseText);
    } else {
      const firstChunk = responseText.slice(0, allowedFirstChunkSize);
      chunks.push(firstChunk);
      const remainingText = responseText.slice(allowedFirstChunkSize);
      for (let i = 0; i < remainingText.length; i += 2000) {
        chunks.push(remainingText.slice(i, i + 2000));
      }
    }

    return res.status(200).json({
      type: 4,
      data: {
        content: mentionText + chunks[0]
      }
    });
  }

  return res.status(200).send({type: 1});
};
