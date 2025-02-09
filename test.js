const axios = require('axios');

async function testInteraction() {
  const payload = {
    type: 1 // This simulates a PING from Discord
  };

  try {
    const response = await axios.post('http://localhost:3000/api/interactions', payload, {
      headers: {
        "Content-Type": "application/json",
        // Use dummy values for local testing or bypass signature verification temporarily.
        "x-signature-ed25519": "test-signature",
        "x-signature-timestamp": Date.now().toString()
      }
    });
    console.log("Response:", response.data);
  } catch (error) {
    console.error("Error:", error.response ? error.response.data : error.message);
  }
}

testInteraction();
