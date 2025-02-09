const axios = require('axios');

const BOT_TOKEN = process.env.TOKEN;
const APPLICATION_ID = '';

async function registerCommand() {
  try {
    const response = await axios.post(
      `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`,
      {
        name: 'chat',
        description: 'Chat with the bot',
        options: [
          {
            name: 'message',
            description: 'The message to send to the bot',
            type: 3,
            required: true
          }
        ]
      },
      {
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Command registered successfully:', response.data);
  } catch (error) {
    console.error('Failed to register command:', error.response ? error.response.data : error.message);
  }
}

registerCommand();