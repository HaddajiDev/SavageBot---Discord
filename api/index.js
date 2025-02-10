const nacl = require('tweetnacl');
const axios = require('axios');
require('dotenv').config()

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
const OPENROUTER_API_KEY = process.env.API;
const OPENROUTER_URL = process.env.URL;
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT;

const chatHistory = {};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
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

  if (!signature || !timestamp) {
    return res.status(401).send("Missing signature headers");
  }

  const isVerified = nacl.sign.detached.verify(
    Buffer.from(timestamp + rawBody),
    Buffer.from(signature, 'hex'),
    Buffer.from(DISCORD_PUBLIC_KEY, 'hex')
  );

  if (!isVerified) {
    return res.status(401).send("Invalid request signature");
  }

  const body = JSON.parse(rawBody);

  if (body.type === 1) {
    return res.status(200).json({ type: 1 });
  }

  if (body.type === 2) {
    const commandName = body.data.name;
    const channelId = body.channel_id;
    const user = body.member.user;
    const userMention = `<@${user.id}>`;    
    const username = body.member.nick || user.global_name || user.username;


    const options = body.data.options || [];
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

    chatHistory[channelId].push({ role: "user", content: `${username}: ${userMessage}` });
    const systemMsg = chatHistory[channelId][0];
    const otherMsgs = chatHistory[channelId].slice(1);
    chatHistory[channelId] = [systemMsg].concat(otherMsgs.slice(-9));

    let responseText = "";
    try {
      const apiResponse = await axios.post(
        OPENROUTER_URL,
        {
          model: process.env.MODEL,
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
      const systemMsg = chatHistory[channelId][0];
      const otherMsgs = chatHistory[channelId].slice(1);
      chatHistory[channelId] = [systemMsg].concat(otherMsgs.slice(-9));

    } catch (error) {
      return res.status(400).send("error");
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
        content: chunks[0]
      }
    });
  }

  return res.status(400).send("error");
};