const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.API;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ]
});

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT;

const chatHistory = {};

client.once('ready', () => {
  console.log(`Bot is online as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!ping') {
    return message.channel.send("Fuck off!");
  }

  const channelId = message.channel.id;

  if (!chatHistory[channelId]) {
    chatHistory[channelId] = [{ role: "system", content: SYSTEM_PROMPT }];
  }

  chatHistory[channelId].push({
    role: "user",
    content: message.content
  });

  chatHistory[channelId] = chatHistory[channelId].slice(-10);

  let responseText = "";
  try {
    message.channel.sendTyping();
    const response = await axios.post(
      process.env.URL,
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

    responseText = response.data.choices[0].message.content;

    chatHistory[channelId].push({
      role: "assistant",
      content: responseText
    });
  } catch (error) {
    responseText = `An error occurred: ${error.message}`;
  }

  const mentionText = `${message.author.toString()} `;
  const allowedFirstChunkSize = 2000 - mentionText.length;
  const chunks = [];

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

  for (let i = 0; i < chunks.length; i++) {
    if (i === 0) {
      await message.channel.send(mentionText + chunks[i]);
    } else {
      await message.channel.send(chunks[i]);
    }
  }
});

client.login(process.env.TOKEN);
